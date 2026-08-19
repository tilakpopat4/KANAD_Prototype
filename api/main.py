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

import json
import os
import datetime
import hashlib
import secrets
from pathlib import Path
from typing import Any, Optional, Tuple

from argon2 import PasswordHasher, exceptions as argon2_exceptions
from fastapi import (
    FastAPI, Depends, HTTPException, status, Request, Response,
    APIRouter, Header, UploadFile, File, Form
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
from sqlalchemy.orm import sessionmaker, Session, relationship
import re

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

# Database setup - use shared Base from api.database.database
from api.database.database import Base, engine, SessionLocal

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


# ============================================================
# CHILD SAFETY MODELS
# ============================================================


def generate_child_safety_reference() -> str:
    """Create a non-sequential reference ID for anonymous tracking."""
    return "CSR-" + datetime.datetime.utcnow().strftime("%Y") + "-" + secrets.token_hex(4).upper()


class ChildSafetyReport(Base):
    __tablename__ = "child_safety_reports"
    id = Column(Integer, primary_key=True, index=True)
    reference_id = Column(String, unique=True, index=True, default=generate_child_safety_reference)

    is_anonymous = Column(Boolean, default=True, nullable=False)
    reporter_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reporter_name = Column(String, nullable=True)
    reporter_email = Column(String, nullable=True)
    reporter_phone = Column(String, nullable=True)

    reporting_for = Column(String, nullable=False)
    recency = Column(String, nullable=False)
    incident_datetime = Column(DateTime, nullable=True)
    time_zone = Column(String, default="IST (UTC+5:30)")
    frequency = Column(String, nullable=False)
    location_type = Column(String, nullable=False)
    category_key = Column(String, nullable=False)
    feels_in_danger = Column(String, nullable=False)

    victim_name = Column(String, nullable=True)
    victim_age = Column(Integer, nullable=True)
    victim_identity_unknown = Column(Boolean, default=False)

    platform = Column(String, nullable=True)
    platform_other = Column(String, nullable=True)
    urls_handles = Column(Text, nullable=True)

    suspect_name = Column(String, nullable=True)
    suspect_handle = Column(String, nullable=True)
    suspect_relationship = Column(String, nullable=True)

    narrative = Column(Text, nullable=True)
    raw_payload_json = Column(Text, nullable=True)
    schema_version = Column(String, default="fir_citizen_intake_v1")

    status = Column(String, default="submitted")
    priority = Column(String, default="high")
    escalated = Column(Boolean, default=False)
    routed_to = Column(Text, nullable=True)
    legal_mapping = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    evidence = relationship("ChildSafetyEvidence", back_populates="report")


class ChildSafetyEvidence(Base):
    __tablename__ = "child_safety_evidence"
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("child_safety_reports.id"), nullable=False)
    file_name = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    sha256 = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    is_url_only = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    report = relationship("ChildSafetyReport", back_populates="evidence")


class WomenSafetyReport(Base):
    __tablename__ = "women_safety_reports"
    id = Column(Integer, primary_key=True, index=True)
    reference_id = Column(String, unique=True, index=True, default=lambda: "WSR-" + datetime.datetime.utcnow().strftime("%Y") + "-" + secrets.token_hex(4).upper())
    incident_type = Column(String, nullable=False)
    incident_location = Column(String, nullable=False)
    incident_datetime = Column(DateTime, nullable=True)
    platform = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    evidence_links = Column(Text, nullable=True)
    evidence_notes = Column(Text, nullable=True)
    reporter_name = Column(String, nullable=True)
    reporter_email = Column(String, nullable=True)
    reporter_phone = Column(String, nullable=True)
    is_anonymous = Column(Boolean, default=True)
    raw_payload_json = Column(Text, nullable=True)
    schema_version = Column(String, default="fir_citizen_intake_v1")
    status = Column(String, default="submitted")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# Import digilocker models so tables get created
from digilocker.models import DigiLockerVerification

# Import fraud complaint models so tables get created
from api.modules.fraud_complaint.models import FraudComplaint, FraudTransaction, FraudSubject

# Import FIR models so tables get created
from api.modules.fir.models import FIRComplaint, FIRAccusedPerson, FIRProperty, FIRVictim

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
# CHILD SAFETY SCHEMAS
# ============================================================


class ChildSafetyScreening(BaseModel):
    reporting_for: str
    recency: str
    incident_datetime: Optional[datetime.datetime] = None
    time_zone: str = "IST (UTC+5:30)"
    frequency: str
    location_type: str
    category_key: str
    feels_in_danger: str

    @field_validator("reporting_for")
    @classmethod
    def validate_reporting_for(cls, v: str) -> str:
        allowed = {"myself", "someone_i_know", "url_unknown_victim", "other_activity"}
        if v not in allowed:
            raise ValueError("Invalid reporting_for value")
        return v

    @field_validator("feels_in_danger")
    @classmethod
    def validate_feels_in_danger(cls, v: str) -> str:
        allowed = {"yes", "no", "unknown"}
        if v not in allowed:
            raise ValueError("Invalid feels_in_danger value")
        return v

    @field_validator("location_type")
    @classmethod
    def validate_location_type(cls, v: str) -> str:
        allowed = {"online", "offline", "both"}
        if v not in allowed:
            raise ValueError("Invalid location_type value")
        return v

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        allowed = {"one_time", "ongoing"}
        if v not in allowed:
            raise ValueError("Invalid frequency value")
        return v


class ChildSafetyReportCreate(BaseModel):
    is_anonymous: bool = True
    reporter_name: Optional[str] = None
    reporter_email: Optional[EmailStr] = None
    reporter_phone: Optional[str] = None
    screening: ChildSafetyScreening
    victim_name: Optional[str] = None
    victim_age: Optional[int] = Field(default=None, ge=0, le=17)
    victim_identity_unknown: bool = False
    platform: Optional[str] = None
    platform_other: Optional[str] = None
    urls_handles: Optional[str] = None
    suspect_name: Optional[str] = None
    suspect_handle: Optional[str] = None
    suspect_relationship: Optional[str] = None
    narrative: Optional[str] = Field(default=None, max_length=5000)
    schema_version: str = "fir_citizen_intake_v1"
    form_payload: Optional[dict[str, Any]] = None


class WomenSafetyReportCreate(BaseModel):
    incident_type: str
    incident_datetime: Optional[datetime.datetime] = None
    incident_location: str
    platform: Optional[str] = None
    description: str = Field(min_length=10, max_length=5000)
    evidence_links: Optional[str] = None
    evidence_notes: Optional[str] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[EmailStr] = None
    reporter_phone: Optional[str] = None
    report_relation: Optional[str] = None
    suspect_name: Optional[str] = None
    suspect_handle: Optional[str] = None
    suspect_relationship: Optional[str] = None
    narrative: Optional[str] = Field(default=None, max_length=5000)
    is_anonymous: bool = True
    schema_version: str = "fir_citizen_intake_v1"
    form_payload: Optional[dict[str, Any]] = None


class ChildSafetyReportResponse(BaseModel):
    reference_id: str
    status: str
    priority: str
    escalated: bool
    routed_to: list[str]
    danger_message: Optional[str] = None
    message: str


class ChildSafetyEvidenceLink(BaseModel):
    url_or_description: str = Field(max_length=2000)


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
# CHILD SAFETY CONFIG & ROUTER
# ============================================================

CHILD_SAFETY_RESOURCES = {
    "immediate_danger": {
        "primary": {"label": "India Unified Emergency", "number": "112"},
        "legacy_police": {"label": "Police (legacy)", "number": "100"},
        "message": "If you or someone you know is in immediate danger, please call 112 or your nearest police station immediately.",
    },
    "direct_support": {
        "childline": {
            "label": "CHILDLINE (Ministry of Women & Child Development)",
            "number": "1098",
            "note": "National 24x7 emergency helpline for children in distress. All languages.",
        },
        "pocso_ebox": {
            "label": "POCSO e-Box (NCPCR)",
            "url": "https://pocsoebox.gov.in",
            "note": "Lets a child directly submit a complaint without an adult intermediary.",
        },
    },
    "other_resources": {
        "domestic_violence": {
            "ncw": {"label": "National Commission for Women", "number": "7827170170"},
            "women_helpline": {"label": "Women Helpline (24x7)", "number": "181"},
        },
        "child_welfare": {
            "childline": {"label": "CHILDLINE", "number": "1098"},
            "pocso_ebox": {"label": "POCSO e-Box", "url": "https://pocsoebox.gov.in"},
        },
    },
    "takedown_help": {
        "stopncii": {"label": "StopNCII.org", "url": "https://stopncii.org", "note": "Free tool for adults. Generates a secure hash on your own device; the image never leaves your device."},
        "take_it_down": {"label": "Take It Down (NCMEC)", "url": "https://takeitdown.ncmec.org", "note": "For anyone who was under 18 when the image/video was taken."},
        "it_rules_2021": "Under India's IT Rules 2021, platforms must have a Grievance Officer and act on takedown requests within a defined timeframe. File a platform-level report in parallel.",
    },
    "law_enforcement": {
        "ncrp": {"label": "National Cyber Crime Reporting Portal", "url": "https://cybercrime.gov.in", "category": "Report Crime related to Women/Child (covers CSEAM, anonymous path available)."},
        "cyber_helpline": {"label": "Cyber Crime Helpline", "number": "1930"},
    },
    "categories": [
        {"key": "csam_possession", "label": "Sharing or possession of sexual images/videos of a child (CSEAM)", "legal": ["IT Act 67B", "POCSO Act", "BNS"]},
        {"key": "grooming_sextortion", "label": "Online grooming / sextortion of a child", "legal": ["POCSO Act", "IT Act 67B", "BNS"]},
        {"key": "live_streamed_abuse", "label": "Live-streamed abuse", "legal": ["POCSO Act", "IT Act 67B"]},
        {"key": "child_trafficking", "label": "Child sex trafficking", "legal": ["BNS", "POCSO Act"]},
        {"key": "online_solicitation", "label": "A child was solicited online for sexual purposes", "legal": ["POCSO Act", "IT Act 67B"]},
        {"key": "pressuring_for_images", "label": "An adult is pressuring a child for sexual images", "legal": ["POCSO Act", "IT Act 67B"]},
        {"key": "other_enticement", "label": "Other online enticement or exploitation of a child", "legal": ["POCSO Act"]},
        {"key": "something_else", "label": "Something else concerning a child's safety online", "legal": []},
    ],
}

WOMEN_SAFETY_RESOURCES = {
    "support": [
        {"label": "Women Helpline", "detail": "Call 181 for immediate women support and emergency guidance."},
        {"label": "Emergency", "detail": "Call 112 if you are in immediate danger or facing a life-threatening situation."},
        {"label": "National Cyber Crime Helpline", "detail": "Call 1930 for cyber-crime support and digital evidence guidance."},
    ],
    "incident_types": [
        {"key": "online_harassment", "label": "Online harassment or abuse"},
        {"key": "stalking", "label": "Stalking or repeated threatening contact"},
        {"key": "blackmail", "label": "Blackmail / extortion / sextortion"},
        {"key": "impersonation", "label": "Fake profile / impersonation"},
        {"key": "image_abuse", "label": "Explicit image or deepfake abuse"},
        {"key": "other", "label": "Other threat or violence"},
    ],
}


CHILD_SAFETY_LEGAL_BY_KEY = {
    item["key"]: item["legal"] for item in CHILD_SAFETY_RESOURCES["categories"]
}


def build_fir_payload(report_type: str, user_payload: dict[str, Any], *, legal_context: Optional[list[str]] = None) -> dict[str, Any]:
    """Normalize report submissions into a FIR-style JSON envelope for future officer workflows."""
    base = {
        "schema_version": "fir_citizen_intake_v1",
        "report_type": report_type,
        "source": "citizen_portal",
        "anonymous_submission": bool(user_payload.get("is_anonymous", True)),
        "reporter": {
            "name": user_payload.get("reporter_name"),
            "email": user_payload.get("reporter_email"),
            "phone": user_payload.get("reporter_phone"),
            "relationship_to_victim": user_payload.get("report_relation"),
        },
        "incident": {
            "category": user_payload.get("incident_type") or user_payload.get("category_key"),
            "location": user_payload.get("incident_location"),
            "datetime": user_payload.get("incident_datetime") or user_payload.get("incident_date"),
            "platform": user_payload.get("platform"),
            "platform_other": user_payload.get("platform_other"),
            "description": user_payload.get("description") or user_payload.get("narrative"),
            "evidence_links": user_payload.get("evidence_links") or user_payload.get("urls_handles"),
            "evidence_notes": user_payload.get("evidence_notes"),
            "narrative": user_payload.get("narrative") or user_payload.get("description"),
            "suspect": {
                "name": user_payload.get("suspect_name"),
                "handle": user_payload.get("suspect_handle"),
                "relationship": user_payload.get("suspect_relationship"),
            },
        },
        "victim": {
            "name": user_payload.get("victim_name"),
            "age": user_payload.get("victim_age"),
            "identity_unknown": user_payload.get("victim_identity_unknown", False),
        },
        "legal_context": legal_context or [],
        "raw_submission": user_payload,
    }
    return base


def child_safety_routing(screening: ChildSafetyScreening) -> list[str]:
    if screening.feels_in_danger == "yes":
        return ["I4C_NCRP", "LOCAL_POLICE", "CWC"]
    if screening.location_type in {"offline", "both"}:
        return ["I4C_NCRP", "CWC"]
    return ["I4C_NCRP"]


child_safety_router = APIRouter(prefix="/api/child-safety", tags=["Child Safety"])
women_safety_router = APIRouter(prefix="/api/women-safety", tags=["Women Safety"])


@child_safety_router.get("/resources")
def get_child_safety_resources() -> dict[str, Any]:
    return CHILD_SAFETY_RESOURCES


@women_safety_router.get("/resources")
def get_women_safety_resources() -> dict[str, Any]:
    return WOMEN_SAFETY_RESOURCES


@women_safety_router.post("/reports", status_code=status.HTTP_201_CREATED)
def submit_women_safety_report(payload: WomenSafetyReportCreate, request: Request, db: Session = Depends(get_db)):
    payload_dict = payload.model_dump(mode="json")
    normalized_payload = build_fir_payload(
        "women_safety",
        {**payload_dict, "is_anonymous": payload.is_anonymous},
        legal_context=["BNS", "IT Act 67B", "POSH / harassment laws"],
    )
    report = WomenSafetyReport(
        incident_type=payload.incident_type,
        incident_location=payload.incident_location,
        incident_datetime=payload.incident_datetime,
        platform=payload.platform,
        description=payload.description,
        evidence_links=payload.evidence_links,
        evidence_notes=payload.evidence_notes,
        reporter_name=None if payload.is_anonymous else payload.reporter_name,
        reporter_email=None if payload.is_anonymous else payload.reporter_email,
        reporter_phone=None if payload.is_anonymous else payload.reporter_phone,
        is_anonymous=payload.is_anonymous,
        raw_payload_json=json.dumps(normalized_payload, default=str),
        schema_version=payload.schema_version,
        status="submitted",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "reference_id": report.reference_id,
        "message": "Your women safety concern has been recorded and will be reviewed by the relevant support team.",
        "status": report.status,
        "schema_version": report.schema_version,
        "payload_json": json.loads(report.raw_payload_json) if report.raw_payload_json else None,
    }


@child_safety_router.post("/reports", response_model=ChildSafetyReportResponse, status_code=status.HTTP_201_CREATED)
def submit_child_safety_report(
    payload: ChildSafetyReportCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    screening = payload.screening
    escalated = screening.feels_in_danger == "yes"
    routed = child_safety_routing(screening)
    legal = CHILD_SAFETY_LEGAL_BY_KEY.get(screening.category_key, [])
    normalized_payload = build_fir_payload(
        "child_safety",
        {
            **payload.model_dump(mode="json"),
            "category_key": screening.category_key,
            "is_anonymous": payload.is_anonymous,
            "reporter_name": payload.reporter_name,
            "reporter_email": payload.reporter_email,
            "reporter_phone": payload.reporter_phone,
            "incident_datetime": screening.incident_datetime,
            "time_zone": screening.time_zone,
            "location_type": screening.location_type,
            "feels_in_danger": screening.feels_in_danger,
            "reporting_for": screening.reporting_for,
            "recency": screening.recency,
            "frequency": screening.frequency,
        },
        legal_context=legal,
    )

    report = ChildSafetyReport(
        is_anonymous=payload.is_anonymous,
        reporter_name=None if payload.is_anonymous else payload.reporter_name,
        reporter_email=None if payload.is_anonymous else payload.reporter_email,
        reporter_phone=None if payload.is_anonymous else payload.reporter_phone,
        reporting_for=screening.reporting_for,
        recency=screening.recency,
        incident_datetime=screening.incident_datetime,
        time_zone=screening.time_zone,
        frequency=screening.frequency,
        location_type=screening.location_type,
        category_key=screening.category_key,
        feels_in_danger=screening.feels_in_danger,
        victim_name=payload.victim_name,
        victim_age=payload.victim_age,
        victim_identity_unknown=payload.victim_identity_unknown,
        platform=payload.platform,
        platform_other=payload.platform_other,
        urls_handles=payload.urls_handles,
        suspect_name=payload.suspect_name,
        suspect_handle=payload.suspect_handle,
        suspect_relationship=payload.suspect_relationship,
        narrative=payload.narrative,
        raw_payload_json=json.dumps(normalized_payload, default=str),
        schema_version=payload.schema_version,
        status="submitted",
        priority="high",
        escalated=escalated,
        routed_to=",".join(routed),
        legal_mapping=",".join(legal),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    danger_message = None
    if escalated:
        danger_message = "If anyone is in immediate danger, please stop and call 112 or your nearest police station right now."

    return ChildSafetyReportResponse(
        reference_id=report.reference_id,
        status=report.status,
        priority=report.priority,
        escalated=report.escalated,
        routed_to=routed,
        danger_message=danger_message,
        message="Your report has been received and will be reviewed by trained analysts, then routed to the appropriate authorities (I4C / cybercrime.gov.in, and where relevant the local Child Welfare Committee and police). Save your reference ID to check status later.",
    )


@child_safety_router.get("/reports/{reference_id}")
def get_child_safety_report(reference_id: str, db: Session = Depends(get_db)):
    report = db.query(ChildSafetyReport).filter(ChildSafetyReport.reference_id == reference_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No report found for this reference ID.")
    return {
        "reference_id": report.reference_id,
        "status": report.status,
        "priority": report.priority,
        "escalated": report.escalated,
        "submitted_at": report.submitted_at,
        "routed_to": report.routed_to.split(",") if report.routed_to else [],
    }


@child_safety_router.post("/reports/{reference_id}/evidence-link", status_code=status.HTTP_201_CREATED)
def add_child_safety_evidence_link(reference_id: str, payload: ChildSafetyEvidenceLink, db: Session = Depends(get_db)):
    report = db.query(ChildSafetyReport).filter(ChildSafetyReport.reference_id == reference_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No report found for this reference ID.")
    db.add(ChildSafetyEvidence(report_id=report.id, description=payload.url_or_description, is_url_only=True))
    db.commit()
    return {"message": "Link/description added. You did not need to re-share distressing material.", "reference_id": reference_id}


@child_safety_router.post("/reports/{reference_id}/evidence", status_code=status.HTTP_201_CREATED)
async def upload_child_safety_evidence(reference_id: str, file: UploadFile = File(...), description: str = Form(""), db: Session = Depends(get_db)):
    report = db.query(ChildSafetyReport).filter(ChildSafetyReport.reference_id == reference_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No report found for this reference ID.")

    upload_dir = ROOT_DIR / "uploads" / "child_safety"
    upload_dir.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    sha256 = hashlib.sha256(content).hexdigest()
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", file.filename or "evidence")
    file_path = upload_dir / f"{report.reference_id}_{safe_name}"
    file_path.write_bytes(content)

    db.add(ChildSafetyEvidence(report_id=report.id, file_name=file.filename, file_path=str(file_path), sha256=sha256, description=description, is_url_only=False))
    db.commit()
    return {"message": "Evidence uploaded.", "sha256": sha256, "reference_id": reference_id}


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
app.include_router(child_safety_router)
app.include_router(women_safety_router)

# Include DigiLocker verification router
from digilocker.routes import router as digilocker_router
app.include_router(digilocker_router)

# Include Fraud Complaint router
from api.modules.fraud_complaint.routes import router as fraud_complaint_router
app.include_router(fraud_complaint_router)

# Include FIR (Report Crime) router
from api.modules.fir.routes import router as fir_router
app.include_router(fir_router)

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
    import os
    port = int(os.environ.get("FORENSYNC_PORT", 8000))
    uvicorn.run(app, host="127.0.0.1", port=port)
