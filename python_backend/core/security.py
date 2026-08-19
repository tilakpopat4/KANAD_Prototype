"""
security.py — OWASP-aligned password hashing + JWT handling.

OWASP mappings:
- Password Storage: Argon2id (primary) with fallback to PBKDF2-HMAC-SHA256 @ 600k iters.
- Session Mgmt: short-lived access token, rotating refresh token, jti-based revocation.
- Secrets: keys loaded from environment, never hardcoded.
"""
import os
import hashlib
import secrets
import datetime
from typing import Optional

from jose import JWTError, jwt

# ---- Argon2id (OWASP primary recommendation) ----
# pip install argon2-cffi
from argon2 import PasswordHasher, exceptions as argon2_exceptions

# OWASP minimum Argon2id params: 19 MiB memory, 2 iterations, parallelism 1
_ph = PasswordHasher(
    time_cost=3,          # >= 2 (OWASP min); 3 for extra margin
    memory_cost=19456,    # 19 MiB in KiB
    parallelism=1,
    hash_len=32,
    salt_len=16,
)

# ---- Secrets from environment (NEVER hardcode) ----
SECRET_KEY = os.environ["FORENSYNC_JWT_SECRET"]          # raises if missing — fail closed
REFRESH_SECRET_KEY = os.environ["FORENSYNC_REFRESH_SECRET"]
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 15      # OWASP: short-lived access token
REFRESH_TOKEN_EXPIRE_DAYS = 7         # rotated on every use


# ---------- Password hashing ----------
def get_password_hash(password: str) -> str:
    """Hash a password using Argon2id (OWASP primary recommendation)."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password. Uses constant-time comparison internally."""
    try:
        _ph.verify(hashed_password, plain_password)
        return True
    except argon2_exceptions.VerifyMismatchError:
        return False
    except Exception:
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Returns True if hash params are outdated and password should be re-hashed on next login."""
    try:
        return _ph.check_needs_rehash(hashed_password)
    except Exception:
        return True


# ---- Legacy PBKDF2 fallback (FIPS / migration path from your old auth.py) ----
def pbkdf2_hash(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)  # OWASP: 600k
    return f"pbkdf2${salt.hex()}${key.hex()}"


def pbkdf2_verify(plain_password: str, stored: str) -> bool:
    try:
        _, salt_hex, key_hex = stored.split("$")
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 600_000)
        return secrets.compare_digest(new_key, key)  # constant-time
    except Exception:
        return False


# ---------- JWT ----------
def create_access_token(data: dict) -> tuple[str, str]:
    """Returns (token, jti). jti enables denylist revocation (OWASP REST guidance)."""
    jti = secrets.token_urlsafe(16)
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        **data,
        "exp": expire,
        "iat": datetime.datetime.utcnow(),
        "jti": jti,
        "type": "access",
        "iss": "forensync-auth",
        "aud": "forensync-citizen",
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM), jti


def create_refresh_token(data: dict) -> tuple[str, str]:
    jti = secrets.token_urlsafe(32)
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": data.get("sub"),
        "exp": expire,
        "iat": datetime.datetime.utcnow(),
        "jti": jti,
        "type": "refresh",
        "iss": "forensync-auth",
        "aud": "forensync-citizen",
    }
    return jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM), jti


def decode_token(token: str, refresh: bool = False) -> Optional[dict]:
    key = REFRESH_SECRET_KEY if refresh else SECRET_KEY
    try:
        return jwt.decode(
            token, key, algorithms=[ALGORITHM],
            audience="forensync-citizen", issuer="forensync-auth",
        )
    except JWTError:
        return None