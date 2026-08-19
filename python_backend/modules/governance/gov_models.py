"""Additional models for government compliance."""
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from database import Base


class PasswordHistory(Base):
    __tablename__ = "password_history"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ConsentRecord(Base):
    """DPDP Act: record every consent given/withdrawn."""
    __tablename__ = "consent_records"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    purpose = Column(Text, nullable=False)
    consent_given = Column(Boolean, default=True)
    ip_address = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class SecurityEvent(Base):
    """CERT-In: security-sensitive incidents for 6-hr reporting workflow."""
    __tablename__ = "security_events"
    id = Column(Integer, primary_key=True)
    event_type = Column(String, nullable=False)   # e.g. BRUTE_FORCE, TOKEN_REUSE
    user_id = Column(Integer, nullable=True)
    ip_address = Column(String)
    detail = Column(Text)
    reported = Column(Boolean, default=False)      # flip once reported to CERT-In
    detected_at = Column(DateTime, default=datetime.datetime.utcnow)