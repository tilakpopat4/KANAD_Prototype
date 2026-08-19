"""
routes.py — Child Safety Reporting endpoints.

Endpoints:
  GET  /api/child-safety/resources        -> all India-localized helplines/categories (public)
  POST /api/child-safety/reports          -> submit report (anonymous allowed, no auth required)
  GET  /api/child-safety/reports/{ref}     -> track by reference id (anonymous tracking)
  POST /api/child-safety/reports/{ref}/evidence      -> optional file upload
  POST /api/child-safety/reports/{ref}/evidence-link -> optional URL/description only
"""
import os
import hashlib
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from sqlalchemy.orm import Session

from ...database import database
from . import config, schemas
from .models import ChildSafetyReport, ChildSafetyEvidence

router = APIRouter(prefix="/api/child-safety", tags=["Child Safety"])

UPLOAD_DIR = "uploads/child_safety"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _category_legal(category_key: str):
    for c in config.INCIDENT_CATEGORIES:
        if c["key"] == category_key:
            return c["legal"]
    return []


def _compute_routing(screening: schemas.ScreeningAnswers):
    if screening.feels_in_danger == "yes":
        return config.ROUTING["danger"]
    if screening.location_type in ("offline", "both"):
        return config.ROUTING["offline_involved"]
    return config.ROUTING["default"]


# ---------- Public resources (section 2.2–2.9) ----------
@router.get("/resources")
def get_resources():
    """Everything the frontend needs to render the safety strip, modals, categories, sidebar."""
    return {
        "immediate_danger": config.IMMEDIATE_DANGER,
        "direct_support": config.DIRECT_SUPPORT,
        "other_resources": config.OTHER_RESOURCES,
        "takedown_help": config.TAKEDOWN_HELP,
        "law_enforcement": config.LAW_ENFORCEMENT,
        "categories": config.INCIDENT_CATEGORIES,
    }


# ---------- Submit report (NO auth required — anonymous by default) ----------
@router.post("/reports", response_model=schemas.ReportResponse, status_code=status.HTTP_201_CREATED)
def submit_report(payload: schemas.ReportCreate, request: Request,
                  db: Session = Depends(database.get_db)):
    s = payload.screening
    escalated = s.feels_in_danger == "yes"
    routed = _compute_routing(s)
    legal = _category_legal(s.category_key)

    report = ChildSafetyReport(
        is_anonymous=payload.is_anonymous,
        reporter_name=None if payload.is_anonymous else payload.reporter_name,
        reporter_email=None if payload.is_anonymous else payload.reporter_email,
        reporter_phone=None if payload.is_anonymous else payload.reporter_phone,
        reporting_for=s.reporting_for,
        recency=s.recency,
        incident_datetime=s.incident_datetime,
        time_zone=s.time_zone,
        frequency=s.frequency,
        location_type=s.location_type,
        category_key=s.category_key,
        feels_in_danger=s.feels_in_danger,
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
        priority="high",                       # child safety always high priority
        escalated=escalated,
        routed_to=",".join(routed),
        legal_mapping=",".join(legal),
        status="submitted",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Danger escalation message (section 2.6) — surfaced back to the UI banner.
    danger_msg = None
    if escalated:
        danger_msg = ("If anyone is in immediate danger, please stop and call 112 "
                      "or your nearest police station right now.")

    return schemas.ReportResponse(
        reference_id=report.reference_id,
        status=report.status,
        priority=report.priority,
        escalated=report.escalated,
        routed_to=routed,
        danger_message=danger_msg,
        message=("Your report has been received and will be reviewed by trained analysts, "
                 "then routed to the appropriate authorities (I4C / cybercrime.gov.in, and where "
                 "relevant the local Child Welfare Committee and police). "
                 "Save your reference ID to check status later."),
    )


# ---------- Track by reference (anonymous-friendly) ----------
@router.get("/reports/{reference_id}")
def track_report(reference_id: str, db: Session = Depends(database.get_db)):
    report = db.query(ChildSafetyReport).filter(
        ChildSafetyReport.reference_id == reference_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No report found for this reference ID.")
    # Return only non-sensitive status info for public tracking.
    return {
        "reference_id": report.reference_id,
        "status": report.status,
        "priority": report.priority,
        "escalated": report.escalated,
        "submitted_at": report.submitted_at,
        "routed_to": report.routed_to.split(",") if report.routed_to else [],
    }


# ---------- Optional evidence: file upload ----------
@router.post("/reports/{reference_id}/evidence", status_code=status.HTTP_201_CREATED)
async def upload_evidence(reference_id: str, file: UploadFile = File(...),
                          description: str = Form(""),
                          db: Session = Depends(database.get_db)):
    report = db.query(ChildSafetyReport).filter(
        ChildSafetyReport.reference_id == reference_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No report found for this reference ID.")

    content = await file.read()
    sha256 = hashlib.sha256(content).hexdigest()   # chain-of-custody hash
    safe_name = f"{report.reference_id}_{secrets_safe(file.filename)}"
    path = os.path.join(UPLOAD_DIR, safe_name)
    with open(path, "wb") as f:
        f.write(content)

    ev = ChildSafetyEvidence(
        report_id=report.id, file_name=file.filename, file_path=path,
        sha256=sha256, description=description, is_url_only=False,
    )
    db.add(ev)
    db.commit()
    return {"message": "Evidence uploaded.", "sha256": sha256, "reference_id": reference_id}


# ---------- Optional evidence: URL / description only (no re-viewing material) ----------
@router.post("/reports/{reference_id}/evidence-link", status_code=status.HTTP_201_CREATED)
def add_evidence_link(reference_id: str, payload: schemas.EvidenceUrlOnly,
                      db: Session = Depends(database.get_db)):
    report = db.query(ChildSafetyReport).filter(
        ChildSafetyReport.reference_id == reference_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No report found for this reference ID.")
    ev = ChildSafetyEvidence(
        report_id=report.id, description=payload.url_or_description, is_url_only=True,
    )
    db.add(ev)
    db.commit()
    return {"message": "Link/description added. You did not need to re-share any material.",
            "reference_id": reference_id}


def secrets_safe(filename: str) -> str:
    import re
    return re.sub(r"[^A-Za-z0-9._-]", "_", filename or "evidence")