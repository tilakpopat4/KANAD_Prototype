"""Government rule enforcement — plug into login/register/password flows."""
import datetime
from sqlalchemy.orm import Session

import database
from . import security
from .gov_config import (PASSWORD_MAX_AGE_DAYS, PASSWORD_HISTORY_COUNT,
                         AUDIT_RETENTION_DAYS)
from .gov_models import PasswordHistory, SecurityEvent, ConsentRecord


def password_expired(user) -> bool:
    """MeitY: enforce 90-day password rotation."""
    if not getattr(user, "password_changed_at", None):
        return True
    age = datetime.datetime.utcnow() - user.password_changed_at
    return age.days >= PASSWORD_MAX_AGE_DAYS


def reused_password(db: Session, user_id: int, new_plain: str) -> bool:
    """MeitY: block reuse of last N passwords."""
    history = (db.query(PasswordHistory)
               .filter(PasswordHistory.user_id == user_id)
               .order_by(PasswordHistory.created_at.desc())
               .limit(PASSWORD_HISTORY_COUNT).all())
    return any(security.verify_password(new_plain, h.hashed_password) for h in history)


def record_password(db: Session, user_id: int, hashed: str):
    db.add(PasswordHistory(user_id=user_id, hashed_password=hashed))
    # keep only last N
    old = (db.query(PasswordHistory)
           .filter(PasswordHistory.user_id == user_id)
           .order_by(PasswordHistory.created_at.desc())
           .offset(PASSWORD_HISTORY_COUNT).all())
    for row in old:
        db.delete(row)
    db.commit()


def record_consent(db: Session, user_id: int, purpose: str, ip: str, given: bool = True):
    """DPDP Act: log consent."""
    db.add(ConsentRecord(user_id=user_id, purpose=purpose, consent_given=given, ip_address=ip))
    db.commit()


def raise_security_event(db: Session, event_type: str, ip: str, user_id=None, detail=""):
    """CERT-In: capture incident for 6-hr reporting window."""
    db.add(SecurityEvent(event_type=event_type, ip_address=ip, user_id=user_id, detail=detail))
    db.commit()


def purge_expired_audit(db: Session):
    """CERT-In/MeitY retention: purge audit logs beyond 2 years."""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=AUDIT_RETENTION_DAYS)
    db.query(database.AuditLog).filter(database.AuditLog.timestamp < cutoff).delete()
    db.commit()