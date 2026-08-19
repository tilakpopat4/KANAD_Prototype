"""routes.py — Fraud complaint endpoints (Steps 1-7 with DigiLocker verification)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.database import database
from . import config, schemas
from .models import FraudComplaint, FraudTransaction, FraudSubject
from digilocker.models import DigiLockerVerification
from digilocker.service import DigiLockerService

router = APIRouter(prefix="/api/fraud-complaints", tags=["Fraud Complaint"])


@router.get("/config")
def get_config():
    """Dropdown option sets + dependent-dropdown maps for the wizard."""
    return {
        "transaction_types": config.TRANSACTION_TYPES,
        "upi_apps": config.UPI_APPS,
        "countries": config.COUNTRIES,
        "countries_with_states": config.COUNTRIES_WITH_STATES,
        "critical_infrastructure": config.CRITICAL_INFRA,  # {sector: [subsectors]}
    }


def _priority(loss):
    if loss is None: return "medium"
    if loss >= 500000: return "high"
    if loss >= 50000: return "medium"
    return "low"


@router.post("", response_model=schemas.FraudComplaintResponse, status_code=status.HTTP_201_CREATED)
def submit(payload: schemas.FraudComplaintIn, db: Session = Depends(database.get_db)):
    # --- Step 7 gate: reject unless a valid DigiLocker verification is attached ---
    verification = db.query(DigiLockerVerification).filter(
        DigiLockerVerification.verify_token == payload.digilocker_verify_token
    ).first()
    
    if not DigiLockerService.is_valid(verification):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Identity verification required. Please verify with DigiLocker before submitting."
        )

    data = payload.model_dump(exclude={"transactions", "subjects", "digilocker_verify_token"})

    # Step 1 -> Step 2 copy: if filer is the complainant, ensure complainant contact mirrors filer
    if payload.filer_is_complainant:
        data["complainant_name"] = data.get("complainant_name") or payload.filer_name
        data["complainant_phone"] = data.get("complainant_phone") or payload.filer_phone
        data["complainant_email"] = data.get("complainant_email") or payload.filer_email

    complaint = FraudComplaint(**data)
    complaint.priority = _priority(payload.total_loss_amount)
    
    # Stamp verified identity onto the complaint (Step 7)
    complaint.digital_signature = verification.verified_name
    complaint.digilocker_verified = True
    complaint.digilocker_txn_id = verification.session_id
    
    complaint.transactions = [FraudTransaction(**t.model_dump()) for t in payload.transactions]
    complaint.subjects = [FraudSubject(**s.model_dump()) for s in payload.subjects]

    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    
    # Consume the verification (one-time use)
    DigiLockerService.consume_verification(db, payload.digilocker_verify_token)
    db.commit()

    return schemas.FraudComplaintResponse(
        reference_id=complaint.reference_id,
        status=complaint.status,
        priority=complaint.priority,
        total_loss_amount=complaint.total_loss_amount,
        transaction_count=len(complaint.transactions),
        subject_count=len(complaint.subjects),
        message="Fraud complaint submitted. Save your reference ID to track status. "
                "For UPI fraud, also call 1930 immediately so banks/NPCI can attempt to freeze funds.",
        verified_identity=verification.verified_name,
        digilocker_verified=True,
        digilocker_txn_id=verification.session_id,
    )


@router.get("/{reference_id}")
def track(reference_id: str, db: Session = Depends(database.get_db)):
    c = db.query(FraudComplaint).filter(FraudComplaint.reference_id == reference_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="No complaint found for this reference ID.")
    return {
        "reference_id": c.reference_id, "status": c.status, "priority": c.priority,
        "total_loss_amount": c.total_loss_amount, "submitted_at": c.submitted_at,
        "transaction_count": len(c.transactions), "subject_count": len(c.subjects),
    }