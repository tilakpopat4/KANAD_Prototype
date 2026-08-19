"""models.py — DigiLocker verification sessions. One verified session gates one complaint submission."""
import datetime, secrets
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from api.database.database import Base


def gen_token():
    return secrets.token_urlsafe(24)


class DigiLockerVerification(Base):
    __tablename__ = "digilocker_verifications"
    id = Column(Integer, primary_key=True, index=True)

    session_id = Column(String, unique=True, index=True)     # provider session id
    verify_token = Column(String, unique=True, index=True, default=gen_token)  # our token, given to frontend

    status = Column(String, default="initiated")             # initiated|verified|failed|expired
    provider = Column(String)                                 # sandbox|simulated|production
    is_simulated = Column(Boolean, default=False)

    # Verified identity (populated on success) — Aadhaar stored MASKED only
    verified_name = Column(String, nullable=True)
    verified_dob = Column(String, nullable=True)
    aadhaar_masked = Column(String, nullable=True)            # e.g. XXXX-XXXX-1234 — never full Aadhaar
    photo_url = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)
    consumed = Column(Boolean, default=False)                 # true once attached to a complaint (one-time use)