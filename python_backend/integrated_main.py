"""
INTEGRATED MAIN.PY - ForenSync Citizen Portal
==============================================
Combines KANAD UI with full backend features:
- OWASP-aligned security (Argon2id, JWT, account lockout)
- Government compliance (MeitY, DPDP Act, CERT-In)
- Token rotation, audit logging, password history
- Role-based access control
- Static file serving for the new UI
"""

from __future__ import annotations

import os
import datetime
import hashlib
import secrets
from pathlib import Path
from typing import Any, Optional, Tuple

from argon2 import PasswordHasher, exceptions as argon2_exceptions
from fastapi import (
    FastAPI, Depends, HTTPException, status, Request, Response,
    APIRouter, Header
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, DateTime, 
    ForeignKey, Text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import re

# Import fraud complaint module
from modules.fraud_complaint.routes import router as fraud_router
from modules.fraud_complaint.models import FraudComplaint, FraudTransaction, FraudSubject

# ============================================================
# CONFIGURATION & SETUP
# ============================================================

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./forensync.db")

JWT_SECRET = os.getenv("FORENSYNC_JWT_SECRET")
REFRESH_SECRET = os.getenv("FORENSYNC_REFRESH_SECRET")

if not JWT_SECRET or not REFRESH_SECRET:
    raise RuntimeError(
        "FORENSYNC_JWT_SECRET and FORENSYNC_REFRESH_SECRET must be set before starting the API."
    )

# Database setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ============================================================
# DATABASE MODELS
# ============================================================

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    role = Column(String, default="citizen")
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    
    # OWASP lockout tracking
    failed_login_attempts = Column(Integer, default=0)
    lockout_until = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    last_login_ip = Column(String, nullable=True)
    
    # MeitY password rotation
    password_changed_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String, unique=True, index=True, nullable=False)
    revoked_at = Column(DateTime, default=datetime.datetime.utcnow)


class PasswordHistory(Base):
    __tablename__ = "password_history"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ConsentRecord(Base):
    __tablename__ = "consent_records"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    purpose = Column(Text, nullable=False)
    consent_given = Column(Boolean, default=True)
    ip_address = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class SecurityEvent(Base):
    __tablename__ = "security_events"
    id = Column(Integer, primary_key=True)
    event_type = Column(String, nullable=False)
    user_id = Column(Integer, nullable=True)
    ip_address = Column(String)
    detail = Column(Text)
    reported = Column(Boolean, default=False)
    detected_at = Column(DateTime, default=datetime.datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    ip_address = Column(String)
    detail = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


# Create tables
Base.metadata.create_all(bind=engine)

# ============================================================
# SECURITY & CRYPTO
# ============================================================

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
PASSWORD_MAX_AGE_DAYS = 90
PASSWORD_HISTORY_COUNT = 5
AUDIT_RETENTION_DAYS = 730

# OWASP Argon2id
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=19456,
    parallelism=1,
    hash_len=32,
    salt_len=16,
)


def get_password_hash(password: str) -> str:
    """Hash password using Argon2id (OWASP primary recommendation)."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password (constant-time comparison)."""
    try:
        _ph.verify(hashed_password, plain_password)
        return True
    except (argon2_exceptions.VerifyMismatchError, Exception):
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Check if password hash params are outdated."""
    try:
        return _ph.check_needs_rehash(hashed_password)
    except Exception:
        return True


def create_access_token(data: dict) -> Tuple[str, str]:
    """Create access token. Returns (token, jti)."""
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
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM), jti


def create_refresh_token(data: dict) -> Tuple[str, str]:
    """Create refresh token. Returns (token, jti)."""
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
    return jwt.encode(to_encode, REFRESH_SECRET, algorithm=ALGORITHM), jti


def decode_token(token: str, refresh: bool = False) -> Optional[dict]:
    """Decode JWT token."""
    key = REFRESH_SECRET if refresh else JWT_SECRET
    try:
        return jwt.decode(
            token, key, algorithms=[ALGORITHM],
            audience="forensync-citizen", issuer="forensync-auth",
        )
    except JWTError:
        return None


# ============================================================
# PYDANTIC SCHEMAS
# ============================================================

class CitizenRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    phone: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Must contain a digit")
        if not re.search(r"[^\w\s]", v):
            raise ValueError("Must contain a special character")
        common = {"password", "12345678", "qwerty", "admin123", "password123"}
        if v.lower() in common:
            raise ValueError("Password is too common")
        return v

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, v: str) -> str:
        if not re.fullmatch(r"[6-9]\d{9}", v):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ============================================================
# DEPENDENCIES
# ============================================================

def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    """Get current authenticated user."""
    unauth = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"}
    )
    if not creds:
        raise unauth
    
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise unauth
    
    # Check denylist
    if db.query(RevokedToken).filter(RevokedToken.jti == payload.get("jti")).first():
        raise unauth
    
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user or not user.is_active:
        raise unauth
    
    return user


def require_role(*allowed_roles: str):
    """Role-based access control factory."""
    def guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return user
    return guard


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def audit_log(db: Session, user_id: Optional[int], action: str, ip: str, detail: str = ""):
    """Log audit event."""
    log = AuditLog(
        user_id=user_id, action=action, ip_address=ip,
        detail=detail, timestamp=datetime.datetime.utcnow(),
    )
    db.add(log)
    db.commit()


def password_expired(user: User) -> bool:
    """Check if password is expired (MeitY: 90 days)."""
    if not user.password_changed_at:
        return True
    age = datetime.datetime.utcnow() - user.password_changed_at
    return age.days >= PASSWORD_MAX_AGE_DAYS


def reused_password(db: Session, user_id: int, new_plain: str) -> bool:
    """Check if password reuses history (MeitY)."""
    history = (db.query(PasswordHistory)
               .filter(PasswordHistory.user_id == user_id)
               .order_by(PasswordHistory.created_at.desc())
               .limit(PASSWORD_HISTORY_COUNT).all())
    return any(verify_password(new_plain, h.hashed_password) for h in history)


def record_password(db: Session, user_id: int, hashed: str):
    """Record password in history (MeitY compliance)."""
    db.add(PasswordHistory(user_id=user_id, hashed_password=hashed))
    old = (db.query(PasswordHistory)
           .filter(PasswordHistory.user_id == user_id)
           .order_by(PasswordHistory.created_at.desc())
           .offset(PASSWORD_HISTORY_COUNT).all())
    for row in old:
        db.delete(row)
    db.commit()


def record_consent(db: Session, user_id: int, purpose: str, ip: str, given: bool = True):
    """Record consent (DPDP Act)."""
    db.add(ConsentRecord(
        user_id=user_id, purpose=purpose, consent_given=given, ip_address=ip
    ))
    db.commit()


def raise_security_event(db: Session, event_type: str, ip: str, user_id=None, detail=""):
    """Raise security event (CERT-In)."""
    db.add(SecurityEvent(
        event_type=event_type, ip_address=ip, user_id=user_id, detail=detail
    ))
    db.commit()


def purge_expired_audit(db: Session):
    """Purge old audit logs (MeitY/CERT-In retention)."""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=AUDIT_RETENTION_DAYS)
    db.query(AuditLog).filter(AuditLog.timestamp < cutoff).delete()
    db.commit()


# ============================================================
# FASTAPI APP & ROUTES
# ============================================================

app = FastAPI(title="ForenSync Citizen Portal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000", "null"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (UI)
if FRONTEND_DIR.exists():
    app.mount("/frontend", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend")

# ============================================================
# AUTH ROUTER
# ============================================================

auth_router = APIRouter(prefix="/api/citizen/auth", tags=["Citizen Auth"])

# OWASP lockout policy
MAX_FAILED = 5
OBSERVATION_WINDOW = 15
LOCKOUT_MINUTES = 15
GENERIC_AUTH_ERROR = "Invalid email or password."


@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: CitizenRegister,
    request: Request,
    db: Session = Depends(get_db)
):
    """Register a new citizen (anti-enumeration enabled)."""
    existing = db.query(User).filter(User.email == payload.email).first()
    
    if not existing:
        user = User(
            email=payload.email,
            full_name=payload.full_name,
            phone=payload.phone,
            role="citizen",
            hashed_password=get_password_hash(payload.password),
            is_active=True,
            email_verified=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Record password history & consent
        record_password(db, user.id, user.hashed_password)
        record_consent(
            db, user.id,
            "Account registration and data processing",
            request.client.host
        )
        audit_log(db, user.id, "REGISTER", request.client.host)
    
    # Same message regardless (anti-enumeration)
    return {
        "message": "If the details are valid, your account has been created. Please verify your email."
    }


@auth_router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Login with OWASP security controls."""
    ip = request.client.host
    user = db.query(User).filter(User.email == payload.email).first()

    # Lockout check
    if user and user.lockout_until and user.lockout_until > datetime.datetime.utcnow():
        audit_log(db, user.id, "LOGIN_BLOCKED_LOCKOUT", ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_AUTH_ERROR
        )

    # Verify credentials (always run hash for timing safety)
    valid = False
    if user and user.is_active:
        valid = verify_password(payload.password, user.hashed_password)
    else:
        verify_password(payload.password, get_password_hash("dummy_password_x"))

    if not valid:
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_FAILED:
                user.lockout_until = datetime.datetime.utcnow() + datetime.timedelta(
                    minutes=LOCKOUT_MINUTES
                )
                user.failed_login_attempts = 0
                audit_log(db, user.id, "ACCOUNT_LOCKED", ip)
            db.commit()
            audit_log(db, user.id, "LOGIN_FAILED", ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_AUTH_ERROR
        )

    # Success: reset counters, optionally re-hash
    if needs_rehash(user.hashed_password):
        user.hashed_password = get_password_hash(payload.password)
    
    user.failed_login_attempts = 0
    user.lockout_until = None
    user.last_login_at = datetime.datetime.utcnow()
    user.last_login_ip = ip
    db.commit()

    # Issue tokens
    access_token, _ = create_access_token({"sub": user.email, "role": user.role})
    refresh_token, refresh_jti = create_refresh_token({"sub": user.email})

    db.add(RefreshToken(
        jti=refresh_jti,
        user_id=user.id,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    # OWASP: store refresh token in HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/citizen/auth",
    )

    audit_log(db, user.id, "LOGIN_SUCCESS", ip)
    return TokenResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@auth_router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Refresh token with rotation."""
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token, refresh=True)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stored = db.query(RefreshToken).filter(RefreshToken.jti == payload["jti"]).first()
    if not stored or stored.revoked or stored.expires_at < datetime.datetime.utcnow():
        # Token reuse detected — revoke all (OWASP)
        if stored:
            db.query(RefreshToken).filter(
                RefreshToken.user_id == stored.user_id
            ).update({RefreshToken.revoked: True})
            db.commit()
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.query(User).filter(User.id == stored.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Rotate: revoke old, issue new
    stored.revoked = True
    new_access, _ = create_access_token({"sub": user.email, "role": user.role})
    new_refresh, new_jti = create_refresh_token({"sub": user.email})
    
    db.add(RefreshToken(
        jti=new_jti,
        user_id=user.id,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/citizen/auth",
    )

    return TokenResponse(
        access_token=new_access,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@auth_router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Logout and revoke refresh token."""
    token = request.cookies.get("refresh_token")
    if token:
        payload = decode_token(token, refresh=True)
        if payload:
            db.query(RefreshToken).filter(
                RefreshToken.jti == payload["jti"]
            ).update({RefreshToken.revoked: True})
            db.commit()
    
    response.delete_cookie("refresh_token", path="/api/citizen/auth")
    return {"message": "Logged out successfully."}


app.include_router(auth_router)

# Include fraud complaint router
app.include_router(fraud_router)

# ============================================================
# GENERAL ROUTES
# ============================================================

@app.get("/")
def serve_dashboard() -> FileResponse:
    """Serve the main dashboard."""
    dashboard = FRONTEND_DIR / "citizen" / "index.html"
    if not dashboard.exists():
        raise FileNotFoundError("index.html not found")
    return FileResponse(dashboard, media_type="text/html")


@app.get("/health")
def health() -> dict[str, str]:
    """Health check."""
    return {"status": "ok"}


@app.get("/api/citizen/profile", dependencies=[Depends(get_current_user)])
def get_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Get current user profile."""
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "is_active": user.is_active,
        "email_verified": user.email_verified,
        "last_login_at": user.last_login_at,
        "password_expired": password_expired(user),
    }


@app.get("/analytics/stats")
def analytics_stats(authorization: str | None = Header(default=None)) -> dict[str, int]:
    """Get analytics stats (optional auth)."""
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(status_code=401, detail="Invalid authorization header.")
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token.")

    return {
        "total_complaints": 128,
        "open_cases": 37,
        "resolved": 84,
        "avg_response_hours": 6,
    }


@app.get("/api/slides")
async def get_slides() -> list[dict[str, Any]]:
    """Get slideshow announcements."""
    return [
        {
            "id": 1,
            "title": "Report Cyber Crimes Safely",
            "description": "File complaints with end-to-end encryption and confidentiality protections.",
            "icon": "shield-check",
            "color_scheme": "info",
            "image_url": None,
        },
        {
            "id": 2,
            "title": "Track Your Case in Real-Time",
            "description": "Monitor investigation progress with secure, verified updates.",
            "icon": "search",
            "color_scheme": "success",
            "image_url": None,
        },
        {
            "id": 3,
            "title": "Multilingual Support",
            "description": "Available in English, Hindi, and Gujarati for accessibility.",
            "icon": "languages",
            "color_scheme": "warning",
            "image_url": None,
        },
    ]


# ============================================================
# STARTUP
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
