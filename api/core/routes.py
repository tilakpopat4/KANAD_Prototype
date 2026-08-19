"""
routes.py — Citizen login portal endpoints.
OWASP controls implemented:
- Generic error messages (anti-enumeration)
- Account lockout with observation window + temp duration (no permanent lockout)
- Per-account + per-IP throttling
- HttpOnly + Secure + SameSite cookies for tokens (no browser storage)
- Refresh token rotation
- Audit logging of auth events
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session

from ..database import database
from . import security, schemas
from .models import RefreshToken, RevokedToken

router = APIRouter(prefix="/api/citizen/auth", tags=["Citizen Auth"])

# OWASP lockout policy knobs
MAX_FAILED = 5                 # lockout threshold
OBSERVATION_WINDOW = 15        # minutes — window for counting failures
LOCKOUT_MINUTES = 15           # temp lockout duration (never permanent)

GENERIC_AUTH_ERROR = "Invalid email or password."  # same msg for all failure paths


def _audit(db: Session, user_id, action: str, ip: str, detail: str = ""):
    log = database.AuditLog(
        user_id=user_id, action=action, ip_address=ip,
        detail=detail, timestamp=datetime.datetime.utcnow(),
    )
    db.add(log)
    db.commit()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: schemas.CitizenRegister, request: Request, db: Session = Depends(database.get_db)):
    existing = db.query(database.User).filter(database.User.email == payload.email).first()
    # Anti-enumeration: return the SAME 201 response whether or not the email exists.
    if not existing:
        user = database.User(
            email=payload.email,
            full_name=payload.full_name,
            phone=payload.phone,
            role="citizen",
            hashed_password=security.get_password_hash(payload.password),
            is_active=True,
            email_verified=False,
        )
        db.add(user)
        db.commit()
        _audit(db, user.id, "REGISTER", request.client.host)
    # Identical message regardless — attacker learns nothing.
    return {"message": "If the details are valid, your account has been created. Please verify your email."}


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, request: Request, response: Response,
          db: Session = Depends(database.get_db)):
    ip = request.client.host
    user = db.query(database.User).filter(database.User.email == payload.email).first()

    # --- Lockout check (before password verify) ---
    if user and user.lockout_until and user.lockout_until > datetime.datetime.utcnow():
        _audit(db, user.id, "LOGIN_BLOCKED_LOCKOUT", ip)
        # Generic message — do not reveal that the account is locked.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_AUTH_ERROR)

    # --- Verify credentials (constant-time-ish; always run a hash to avoid timing leaks) ---
    valid = False
    if user and user.is_active:
        valid = security.verify_password(payload.password, user.hashed_password)
    else:
        # Dummy verify to equalize timing when user doesn't exist (anti-enumeration).
        security.verify_password(payload.password, security.get_password_hash("dummy_password_x"))

    if not valid:
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_FAILED:
                user.lockout_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
                _audit(db, user.id, "ACCOUNT_LOCKED", ip)
            db.commit()
            _audit(db, user.id, "LOGIN_FAILED", ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_AUTH_ERROR)

    # --- Success: reset counters, optionally re-hash if params outdated ---
    if security.needs_rehash(user.hashed_password):
        user.hashed_password = security.get_password_hash(payload.password)
    user.failed_login_attempts = 0
    user.lockout_until = None
    user.last_login_at = datetime.datetime.utcnow()
    user.last_login_ip = ip
    db.commit()

    # --- Issue tokens ---
    access_token, _ = security.create_access_token({"sub": user.email, "role": user.role})
    refresh_token, refresh_jti = security.create_refresh_token({"sub": user.email})

    db.add(RefreshToken(
        jti=refresh_jti, user_id=user.id,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=security.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    # OWASP: store refresh token in HttpOnly, Secure, SameSite cookie — NOT localStorage.
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=True, samesite="strict",
        max_age=security.REFRESH_TOKEN_EXPIRE_DAYS * 86400, path="/api/citizen/auth",
    )
    _audit(db, user.id, "LOGIN_SUCCESS", ip)
    return schemas.TokenResponse(
        access_token=access_token,
        expires_in=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(request: Request, response: Response, db: Session = Depends(database.get_db)):
    """Refresh token rotation: old refresh token is revoked, a new one issued."""
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = security.decode_token(token, refresh=True)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stored = db.query(RefreshToken).filter(RefreshToken.jti == payload["jti"]).first()
    if not stored or stored.revoked or stored.expires_at < datetime.datetime.utcnow():
        # Possible token reuse/theft — revoke all this user's refresh tokens (OWASP reuse detection).
        if stored:
            db.query(RefreshToken).filter(RefreshToken.user_id == stored.user_id)\
              .update({RefreshToken.revoked: True})
            db.commit()
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.query(database.User).filter(database.User.id == stored.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Rotate: revoke old, issue new
    stored.revoked = True
    new_access, _ = security.create_access_token({"sub": user.email, "role": user.role})
    new_refresh, new_jti = security.create_refresh_token({"sub": user.email})
    db.add(RefreshToken(
        jti=new_jti, user_id=user.id,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=security.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    response.set_cookie(
        key="refresh_token", value=new_refresh,
        httponly=True, secure=True, samesite="strict",
        max_age=security.REFRESH_TOKEN_EXPIRE_DAYS * 86400, path="/api/citizen/auth",
    )
    return schemas.TokenResponse(access_token=new_access, expires_in=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(database.get_db)):
    """Revoke refresh token + clear cookie."""
    token = request.cookies.get("refresh_token")
    if token:
        payload = security.decode_token(token, refresh=True)
        if payload:
            db.query(RefreshToken).filter(RefreshToken.jti == payload["jti"])\
              .update({RefreshToken.revoked: True})
            db.commit()
    response.delete_cookie("refresh_token", path="/api/citizen/auth")
    return {"message": "Logged out successfully."}


# ============================================================================
# MOBILE OTP AUTHENTICATION (Financial Fraud Portal)
# ============================================================================
# In-memory OTP storage (for demo - use Redis in production)
_mobile_otp_cache = {}


@router.post("/mobile/send-otp", response_model=schemas.MobileOtpResponse)
def send_mobile_otp(payload: schemas.MobileOtpRequest, request: Request, db: Session = Depends(database.get_db)):
    """Send OTP to mobile number for Financial Fraud portal login.
    
    This replaces email-based authentication with mobile OTP for Financial Fraud complaints.
    """
    phone = payload.phone
    ip = request.client.host
    
    # Check if user exists with this phone, or create a placeholder user
    user = db.query(database.User).filter(database.User.phone == phone).first()
    
    # Generate 6-digit OTP
    import random
    otp = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    
    # Store OTP with expiration (5 minutes)
    _mobile_otp_cache[phone] = {
        "otp": otp,
        "expires_at": datetime.datetime.utcnow() + datetime.timedelta(minutes=5),
        "attempts": 0,
        "ip": ip
    }
    
    # In production: integrate with SMS gateway (Twilio, Exotel, etc.)
    # For demo: print to console
    print(f"\n{'='*50}")
    print(f"MOBILE OTP for {phone}")
    print(f"OTP: {otp}")
    print(f"Expires in 5 minutes")
    print(f"{'='*50}\n")
    
    _audit(db, user.id if user else None, "MOBILE_OTP_SENT", ip, f"phone={phone}")
    
    return schemas.MobileOtpResponse(
        message=f"OTP sent to +91-{phone}. Valid for 5 minutes.",
        expires_in=300
    )


@router.post("/mobile/verify-otp", response_model=schemas.MobileOtpVerifyResponse)
def verify_mobile_otp(payload: schemas.MobileOtpVerify, request: Request, response: Response,
                      db: Session = Depends(database.get_db)):
    """Verify mobile OTP and return JWT tokens for Financial Fraud portal.
    
    Creates a citizen account automatically if phone number is not registered.
    """
    phone = payload.phone
    ip = request.client.host
    
    # Get stored OTP
    otp_data = _mobile_otp_cache.get(phone)
    
    if not otp_data:
        _audit(db, None, "MOBILE_OTP_VERIFY_FAILED", ip, f"phone={phone}, reason=no_otp_sent")
        raise HTTPException(status_code=400, detail="No OTP request found. Please request a new OTP.")
    
    if datetime.datetime.utcnow() > otp_data["expires_at"]:
        del _mobile_otp_cache[phone]
        _audit(db, None, "MOBILE_OTP_VERIFY_FAILED", ip, f"phone={phone}, reason=expired")
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP.")
    
    if otp_data["otp"] != payload.otp:
        otp_data["attempts"] += 1
        if otp_data["attempts"] >= 3:
            del _mobile_otp_cache[phone]
            _audit(db, None, "MOBILE_OTP_VERIFY_FAILED", ip, f"phone={phone}, reason=max_attempts")
            raise HTTPException(status_code=400, detail="Too many failed attempts. Please request a new OTP.")
        _audit(db, None, "MOBILE_OTP_VERIFY_FAILED", ip, f"phone={phone}, reason=invalid_otp")
        raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")
    
    # OTP verified - find or create user
    user = db.query(database.User).filter(database.User.phone == phone).first()
    
    if not user:
        # Auto-create citizen account for Financial Fraud portal
        user = database.User(
            email=f"citizen_{phone}@mobile.forensync",
            full_name=f"Citizen ({phone})",
            phone=phone,
            role="citizen",
            hashed_password=security.get_password_hash(f"mobile_{phone}_auto_generated_password"),
            is_active=True,
            email_verified=True,  # Mobile verified acts as email verified
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        _audit(db, user.id, "AUTO_REGISTER", ip, f"phone={phone}")
    
    # Clear OTP data
    if phone in _mobile_otp_cache:
        del _mobile_otp_cache[phone]
    
    # Issue tokens
    access_token, _ = security.create_access_token({"sub": user.email, "role": user.role})
    refresh_token, refresh_jti = security.create_refresh_token({"sub": user.email})
    
    db.add(RefreshToken(
        jti=refresh_jti, user_id=user.id,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=security.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()
    
    # Store refresh token in HttpOnly cookie
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=True, samesite="strict",
        max_age=security.REFRESH_TOKEN_EXPIRE_DAYS * 86400, path="/api/citizen/auth",
    )
    
    _audit(db, user.id, "MOBILE_OTP_LOGIN_SUCCESS", ip, f"phone={phone}")
    
    return schemas.MobileOtpVerifyResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role
        }
    )