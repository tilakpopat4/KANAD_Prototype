"""
models.py — Child safety report models.
Design principle: a report can be fully ANONYMOUS. reporter_user_id is nullable;
victim/suspect/contact fields are all nullable. Only the screening answers are required.
"""
import datetime
import secrets
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


def generate_reference():
    # Non-sequential, unguessable reference so an anonymous reporter can track status.
    return "CSR-" + datetime.datetime.utcnow().strftime("%Y") + "-" + secrets.token_hex(4).upper()


class ChildSafetyReport(Base):
    __tablename__ = "child_safety_reports"

    id = Column(Integer, primary_key=True, index=True)
    reference_id = Column(String, unique=True, index=True, default=generate_reference)

    # --- Reporter (all optional — anonymous by default) ---
    is_anonymous = Column(Boolean, default=True, nullable=False)
    reporter_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reporter_name = Column(String, nullable=True)
    reporter_email = Column(String, nullable=True)
    reporter_phone = Column(String, nullable=True)

    # --- Screening answers (section 2.6, required) ---
    reporting_for = Column(String, nullable=False)      # myself|someone_i_know|url_unknown_victim|other_activity
    recency = Column(String, nullable=False)            # not_yet|today|lt_1_month|1_6_months|6_12_months|over_year|unknown
    incident_datetime = Column(DateTime, nullable=True) # best estimate
    time_zone = Column(String, default="IST (UTC+5:30)")
    frequency = Column(String, nullable=False)          # one_time|ongoing
    location_type = Column(String, nullable=False)      # online|offline|both
    category_key = Column(String, nullable=False)       # from INCIDENT_CATEGORIES
    feels_in_danger = Column(String, nullable=False)    # yes|no|unknown

    # --- Victim (section 2.7, all optional / can be unknown) ---
    victim_name = Column(String, nullable=True)
    victim_age = Column(Integer, nullable=True)
    victim_identity_unknown = Column(Boolean, default=False)

    # --- Platform / online context ---
    platform = Column(String, nullable=True)            # dropdown value or "Other"
    platform_other = Column(String, nullable=True)
    urls_handles = Column(Text, nullable=True)          # URLs / usernames / handles / emails

    # --- Suspect (all optional) ---
    suspect_name = Column(String, nullable=True)
    suspect_handle = Column(String, nullable=True)
    suspect_relationship = Column(String, nullable=True)

    # --- Narrative ---
    narrative = Column(Text, nullable=True)

    # --- System / routing ---
    status = Column(String, default="submitted")        # submitted|under_review|routed|closed
    priority = Column(String, default="high")           # child safety defaults high
    escalated = Column(Boolean, default=False)          # true if feels_in_danger == yes
    routed_to = Column(Text, nullable=True)             # comma-joined ROUTING destinations
    legal_mapping = Column(Text, nullable=True)         # comma-joined act references
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    evidence = relationship("ChildSafetyEvidence", back_populates="report")


class ChildSafetyEvidence(Base):
    """Evidence is OPTIONAL. A URL or description alone is sufficient."""
    __tablename__ = "child_safety_evidence"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("child_safety_reports.id"), nullable=False)
    file_name = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    sha256 = Column(String, nullable=True)              # chain-of-custody hash (reuse Part 1 pattern)
    description = Column(Text, nullable=True)
    is_url_only = Column(Boolean, default=False)        # true when only a link/description was provided
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    report = relationship("ChildSafetyReport", back_populates="evidence")