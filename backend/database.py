import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

import os
if os.environ.get("VERCEL"):
    DATABASE_URL = "sqlite:////tmp/forensync.db"
else:
    DATABASE_URL = "sqlite:///./forensync.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, default="citizen")  # citizen | employee | admin
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    desk = Column(String, nullable=True) # Desk assignment for employee
    is_active = Column(Integer, default=1) # 1 = active, 0 = deactivated

    complaints = relationship("Complaint", back_populates="citizen", foreign_keys="Complaint.citizen_id")

class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String, unique=True, index=True, nullable=False)
    citizen_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String, nullable=False)  # financial_fraud | impersonation | hacking | other
    description = Column(Text, nullable=False)
    language = Column(String, default="en") # en | hi | gu
    status = Column(String, default="pending")  # pending | investigating | resolved
    priority_score = Column(Integer, default=1)  # 1 to 5
    assigned_desk = Column(String, default="General Desk")
    is_severe = Column(Integer, default=0) # 0 = routine, 1 = severe
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    citizen = relationship("User", back_populates="complaints", foreign_keys=[citizen_id])
    evidences = relationship("Evidence", back_populates="complaint", cascade="all, delete-orphan")
    notes = relationship("CaseNote", back_populates="complaint", cascade="all, delete-orphan")
    fir_drafts = relationship("FirDraft", back_populates="complaint", cascade="all, delete-orphan")

class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # .evtx | .sqlite etc
    storage_path = Column(String, nullable=False)
    sha256_hash = Column(String, nullable=False)
    scan_status = Column(String, default="pending") # pending | clean | flagged
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    complaint = relationship("Complaint", back_populates="evidences")
    timeline_events = relationship("TimelineEvent", back_populates="evidence", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="evidence", cascade="all, delete-orphan")

class TimelineEvent(Base):
    __tablename__ = "timeline_events"
    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=False)
    event_timestamp_utc = Column(String, nullable=False)  # Normalized ISO UTC string
    event_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    source_field = Column(String, nullable=False)

    evidence = relationship("Evidence", back_populates="timeline_events")

class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=True)
    action = Column(String, nullable=False)  # uploaded | scanned | hashed | parsed | viewed | exported
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    hash_at_time = Column(String, nullable=True)

    evidence = relationship("Evidence", back_populates="audit_logs")
    actor = relationship("User")

class CaseNote(Base):
    __tablename__ = "case_notes"
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    complaint = relationship("Complaint", back_populates="notes")
    employee = relationship("User")

class FirDraft(Base):
    __tablename__ = "fir_drafts"
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    generated_text = Column(Text, nullable=False)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="draft")  # draft | filed

    complaint = relationship("Complaint", back_populates="fir_drafts")
    reviewer = relationship("User")

class Slide(Base):
    __tablename__ = "slides"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    icon = Column(String, default="info")
    color_scheme = Column(String, default="info")
    image_url = Column(String, nullable=True)  # Optional background image URL
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
