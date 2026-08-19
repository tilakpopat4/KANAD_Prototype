"""
models.py — extends your existing database.py models.
Adds: lockout tracking on User, refresh-token store, revoked-token denylist.
"""
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from database import Base  # reuse your existing declarative Base


class CitizenAuthMixin:
    """Fields to add to your existing User model for OWASP lockout support."""
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    lockout_until = Column(DateTime, nullable=True)          # temp lockout, never permanent
    last_login_at = Column(DateTime, nullable=True)
    last_login_ip = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class RevokedToken(Base):
    """Access-token denylist by jti — enables real logout (OWASP REST guidance)."""
    __tablename__ = "revoked_tokens"
    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String, unique=True, index=True, nullable=False)
    revoked_at = Column(DateTime, default=datetime.datetime.utcnow)