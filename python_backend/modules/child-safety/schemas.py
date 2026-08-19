"""schemas.py — Pydantic models. Only screening fields are required; everything else optional."""
import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator


# ---- Screening (section 2.6) ----
class ScreeningAnswers(BaseModel):
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
    def _rf(cls, v):
        allowed = {"myself", "someone_i_know", "url_unknown_victim", "other_activity"}
        if v not in allowed: raise ValueError("Invalid reporting_for value")
        return v

    @field_validator("feels_in_danger")
    @classmethod
    def _fd(cls, v):
        if v not in {"yes", "no", "unknown"}: raise ValueError("Invalid feels_in_danger value")
        return v

    @field_validator("location_type")
    @classmethod
    def _lt(cls, v):
        if v not in {"online", "offline", "both"}: raise ValueError("Invalid location_type value")
        return v

    @field_validator("frequency")
    @classmethod
    def _fr(cls, v):
        if v not in {"one_time", "ongoing"}: raise ValueError("Invalid frequency value")
        return v


# ---- Full report submission ----
class ReportCreate(BaseModel):
    # anonymity-first: default anonymous, all reporter fields optional
    is_anonymous: bool = True
    reporter_name: Optional[str] = None
    reporter_email: Optional[EmailStr] = None
    reporter_phone: Optional[str] = None

    screening: ScreeningAnswers

    victim_name: Optional[str] = None
    victim_age: Optional[int] = Field(default=None, ge=0, le=17)
    victim_identity_unknown: bool = False

    platform: Optional[str] = None
    platform_other: Optional[str] = None
    urls_handles: Optional[str] = None

    suspect_name: Optional[str] = None
    suspect_handle: Optional[str] = None
    suspect_relationship: Optional[str] = None

    narrative: Optional[str] = Field(default=None, max_length=5000)  # matches char-counter pattern


class ReportResponse(BaseModel):
    reference_id: str
    status: str
    priority: str
    escalated: bool
    routed_to: List[str]
    danger_message: Optional[str] = None
    message: str


class EvidenceUrlOnly(BaseModel):
    """When citizen provides only a link/description — no file, no re-viewing distressing material."""
    url_or_description: str = Field(max_length=2000)