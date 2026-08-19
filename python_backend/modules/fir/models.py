"""
models.py — FIR (First Information Report) based on NCRB I.I.F.-I Schema.
Compliant with Section 154 Cr.P.C. for citizen intake.
"""
import datetime
import secrets
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from api.database.database import Base


def gen_fir_ref():
    """Generate FIR reference ID like FIR-2026-8A3B."""
    return "FIR-" + datetime.datetime.utcnow().strftime("%Y") + "-" + secrets.token_hex(3).upper()


class FIRComplaint(Base):
    """Main FIR complaint — maps to Section 154 Cr.P.C. citizen intake."""
    __tablename__ = "fir_complaints"
    id = Column(Integer, primary_key=True, index=True)
    reference_id = Column(String, unique=True, index=True, default=gen_fir_ref)
    
    # Status & System
    status = Column(String, default="submitted")
    priority = Column(String, default="medium")
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # 6: Complainant Details
    complainant_name = Column(String, nullable=False)
    complainant_parent_spouse_name = Column(String, nullable=False)
    complainant_dob = Column(DateTime, nullable=False)
    complainant_nationality = Column(String, nullable=False, default="Indian")
    complainant_has_passport = Column(Boolean, default=False)
    complainant_passport_no = Column(String, nullable=True)
    complainant_passport_issue_date = Column(DateTime, nullable=True)
    complainant_passport_issue_place = Column(String, nullable=True)
    complainant_occupation = Column(String, nullable=False)
    complainant_address = Column(Text, nullable=False)
    complainant_phone = Column(String, nullable=False)
    complainant_email = Column(String, nullable=True)
    
    # 3: When Did It Happen
    incident_date_from = Column(DateTime, nullable=False)
    incident_date_to = Column(DateTime, nullable=True)
    incident_time_from = Column(String, nullable=True)
    incident_time_to = Column(String, nullable=True)
    incident_day = Column(String, nullable=True)
    reporting_delay_reason = Column(Text, nullable=True)
    
    # 5: Where Did It Happen
    district = Column(String, nullable=False)
    police_station = Column(String, nullable=False)
    occurrence_address = Column(Text, nullable=False)
    occurrence_direction_distance_from_ps = Column(String, nullable=True)
    occurrence_geolocation_lat = Column(Float, nullable=True)
    occurrence_geolocation_lng = Column(Float, nullable=True)
    occurrence_outside_ps_limits = Column(Boolean, default=False)
    occurrence_actual_ps_name = Column(String, nullable=True)
    occurrence_actual_district = Column(String, nullable=True)
    
    # 12: What Happened
    incident_narrative = Column(Text, nullable=False)
    incident_category_hint = Column(String, nullable=True)
    
    # AI-Suggested sections
    ai_suggested_sections = Column(Text, nullable=True)
    
    # 14: Declaration
    declaration_true_to_knowledge = Column(Boolean, default=False)
    e_signature_or_otp_verification = Column(String, nullable=False)
    
    # DigiLocker
    digilocker_verified = Column(Boolean, default=False)
    digilocker_verified_name = Column(String, nullable=True)
    digilocker_txn_id = Column(String, nullable=True)
    
    # Relationships
    accused_persons = relationship("FIRAccusedPerson", back_populates="fir", cascade="all, delete-orphan")
    properties = relationship("FIRProperty", back_populates="fir", cascade="all, delete-orphan")
    victims = relationship("FIRVictim", back_populates="fir", cascade="all, delete-orphan")


class FIRAccusedPerson(Base):
    """7: Accused Details (repeatable)."""
    __tablename__ = "fir_accused_persons"
    id = Column(Integer, primary_key=True, index=True)
    fir_id = Column(Integer, ForeignKey("fir_complaints.id"), nullable=False)
    
    accused_status = Column(String, nullable=False)
    accused_name = Column(String, nullable=True)
    accused_address_or_description = Column(Text, nullable=True)
    accused_sex = Column(String, nullable=True)
    accused_approx_age_or_dob = Column(String, nullable=True)
    accused_build = Column(String, nullable=True)
    accused_height_cm = Column(Float, nullable=True)
    accused_complexion = Column(String, nullable=True)
    accused_identification_marks = Column(String, nullable=True)
    accused_dress = Column(String, nullable=True)
    accused_language_dialect = Column(String, nullable=True)
    accused_vehicle_used = Column(String, nullable=True)
    
    fir = relationship("FIRComplaint", back_populates="accused_persons")


class FIRProperty(Base):
    """9,10: Property Stolen/Damaged (repeatable)."""
    __tablename__ = "fir_properties"
    id = Column(Integer, primary_key=True, index=True)
    fir_id = Column(Integer, ForeignKey("fir_complaints.id"), nullable=False)
    
    property_description = Column(Text, nullable=False)
    property_estimated_value = Column(Float, nullable=True)
    property_quantity = Column(String, nullable=True)
    property_identification_marks = Column(String, nullable=True)
    
    fir = relationship("FIRComplaint", back_populates="properties")


class FIRVictim(Base):
    """IIF-II Item 5: Victim Details (different from complainant)."""
    __tablename__ = "fir_victims"
    id = Column(Integer, primary_key=True, index=True)
    fir_id = Column(Integer, ForeignKey("fir_complaints.id"), nullable=False)
    
    victim_same_as_complainant = Column(Boolean, default=True)
    victim_name = Column(String, nullable=True)
    victim_parent_spouse_name = Column(String, nullable=True)
    victim_dob = Column(DateTime, nullable=True)
    victim_sex = Column(String, nullable=True)
    victim_occupation = Column(String, nullable=True)
    victim_address = Column(Text, nullable=True)
    victim_injury_type = Column(String, nullable=True)
    victim_injury_cause = Column(String, nullable=True)
    
    fir = relationship("FIRComplaint", back_populates="victims")
