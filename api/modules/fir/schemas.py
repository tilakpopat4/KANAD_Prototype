"""
schemas.py — Pydantic schemas for FIR based on NCRB I.I.F.-I Schema.
"""
from datetime import datetime, date, time
from typing import List, Optional
from pydantic import BaseModel, Field


# ───────────────────────────────────────────────────────────────
# Nested Schemas (Repeatable Sections)
# ───────────────────────────────────────────────────────────────

class AccusedPersonBase(BaseModel):
    """Schema for Accused Person (FIR Item 7)."""
    accused_status: str = Field(..., description="Known, Suspected, Unknown")
    accused_name: Optional[str] = None
    accused_address_or_description: Optional[str] = None
    accused_sex: Optional[str] = None  # Male, Female, Other, Unknown
    accused_approx_age_or_dob: Optional[str] = None
    accused_build: Optional[str] = None
    accused_height_cm: Optional[float] = None
    accused_complexion: Optional[str] = None
    accused_identification_marks: Optional[str] = None
    accused_dress: Optional[str] = None
    accused_language_dialect: Optional[str] = None
    accused_vehicle_used: Optional[str] = None


class PropertyItemBase(BaseModel):
    """Schema for Property Stolen/Damaged (FIR Items 9,10)."""
    property_description: str
    property_estimated_value: Optional[float] = None
    property_quantity: Optional[str] = None
    property_identification_marks: Optional[str] = None


class VictimBase(BaseModel):
    """Schema for Victim Details (IIF-II Item 5)."""
    victim_same_as_complainant: bool = True
    victim_name: Optional[str] = None
    victim_parent_spouse_name: Optional[str] = None
    victim_dob: Optional[date] = None
    victim_sex: Optional[str] = None  # Male, Female, Other
    victim_occupation: Optional[str] = None
    victim_address: Optional[str] = None
    victim_injury_type: Optional[str] = None  # None, Simple, Grievous
    victim_injury_cause: Optional[str] = None


# ───────────────────────────────────────────────────────────────
# Config Response
# ───────────────────────────────────────────────────────────────

class FIRConfigResponse(BaseModel):
    """Configuration data for FIR form dropdowns."""
    districts: List[dict]
    police_stations: List[dict]
    incident_categories: List[str]
    sex_options: List[str]
    build_options: List[str]
    skin_colors: List[str]
    days_of_week: List[str]
    injury_types: List[str]


# ───────────────────────────────────────────────────────────────
# Create Request/Response
# ───────────────────────────────────────────────────────────────

class FIRComplaintCreate(BaseModel):
    """Schema for creating a new FIR complaint."""
    
    # Complainant Details
    complainant_name: str
    complainant_parent_spouse_name: str
    complainant_dob: date
    complainant_nationality: str = "Indian"
    complainant_has_passport: bool = False
    complainant_passport_no: Optional[str] = None
    complainant_passport_issue_date: Optional[date] = None
    complainant_passport_issue_place: Optional[str] = None
    complainant_occupation: str
    complainant_address: str
    complainant_phone: str
    complainant_email: Optional[str] = None
    
    # Incident Timing
    incident_date_from: date
    incident_date_to: Optional[date] = None
    incident_time_from: Optional[str] = None
    incident_time_to: Optional[str] = None
    incident_day: Optional[str] = None
    reporting_delay_reason: Optional[str] = None
    
    # Place of Occurrence
    district: str
    police_station: str
    occurrence_address: str
    occurrence_direction_distance_from_ps: Optional[str] = None
    occurrence_geolocation_lat: Optional[float] = None
    occurrence_geolocation_lng: Optional[float] = None
    occurrence_outside_ps_limits: bool = False
    occurrence_actual_ps_name: Optional[str] = None
    occurrence_actual_district: Optional[str] = None
    
    # Complaint Narrative
    incident_narrative: str
    incident_category_hint: Optional[str] = None
    
    # Declaration
    declaration_true_to_knowledge: bool
    e_signature_or_otp_verification: str
    
    # Repeatable sections
    accused_persons: Optional[List[AccusedPersonBase]] = []
    properties: Optional[List[PropertyItemBase]] = []
    victims: Optional[List[VictimBase]] = []
    
    # DigiLocker
    digilocker_verified: bool = False
    digilocker_verified_name: Optional[str] = None
    digilocker_txn_id: Optional[str] = None


class FIRComplaintResponse(BaseModel):
    """Schema for FIR complaint response."""
    id: int
    reference_id: str
    status: str
    priority: str
    submitted_at: datetime
    
    # Complainant
    complainant_name: str
    complainant_phone: str
    complainant_email: Optional[str]
    
    # Incident
    incident_date_from: date
    incident_date_to: Optional[date]
    incident_category_hint: Optional[str]
    incident_narrative: str
    
    # Location
    district: str
    police_station: str
    occurrence_address: str
    
    # AI Suggestion
    ai_suggested_sections: Optional[str]
    
    # DigiLocker
    digilocker_verified: bool
    digilocker_verified_name: Optional[str]
    
    accused_persons: List[AccusedPersonBase]
    properties: List[PropertyItemBase]
    victims: List[VictimBase]
    
    class Config:
        from_attributes = True


class FIRTrackResponse(BaseModel):
    """Schema for tracking FIR status."""
    reference_id: str
    status: str
    priority: str
    submitted_at: datetime
    incident_category_hint: Optional[str]
    incident_narrative: str
    district: str
    police_station: str
    updated_at: datetime
