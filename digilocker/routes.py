"""routes.py — DigiLocker verification endpoints for Step 7."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.database.database import get_db
from . import config
from .models import DigiLockerVerification
from .service import DigiLockerService

router = APIRouter(prefix="/api/digilocker", tags=["DigiLocker Verification"])


class SimOtp(BaseModel):
    verify_token: str
    otp: str


@router.post("/start")
def start(request: Request, db: Session = Depends(get_db)):
    """Begin verification. Returns an authorization_url to redirect/opens the DigiLocker consent screen."""
    result = DigiLockerService.start(db, config.REDIRECT_URL)
    return result


@router.get("/status/{verify_token}")
def status(verify_token: str, db: Session = Depends(get_db)):
    v = db.query(DigiLockerVerification).filter(
        DigiLockerVerification.verify_token == verify_token).first()
    if not v:
        raise HTTPException(status_code=404, detail="Unknown verification token")
    if v.provider == "sandbox" and v.status == "initiated":
        DigiLockerService.poll_sandbox(db, v)   # refresh from provider
    return {"verify_token": v.verify_token, "status": v.status,
            "verified_name": v.verified_name, "aadhaar_masked": v.aadhaar_masked,
            "simulated": v.is_simulated}


@router.get("/callback")
def callback(request: Request, db: Session = Depends(get_db)):
    """DigiLocker/Sandbox redirects the citizen here after consent+OTP. We just refresh status."""
    # Sandbox returns session context; we match on the most recent initiated sandbox session.
    return {"message": "Verification callback received. Poll /status/{verify_token} for the result."}


@router.post("/simulate-complete")
def simulate_complete(body: SimOtp, db: Session = Depends(get_db)):
    """DEMO ONLY — completes a simulated verification with any 6-digit OTP (e.g. 123456)."""
    v = db.query(DigiLockerVerification).filter(
        DigiLockerVerification.verify_token == body.verify_token).first()
    if not v or not v.is_simulated:
        raise HTTPException(status_code=400, detail="Not a simulated session")
    done = DigiLockerService.complete_simulated(db, v, body.otp)
    if not done:
        raise HTTPException(status_code=400, detail="Enter a 6-digit OTP (e.g. 123456)")
    return {"status": "verified", "verified_name": v.verified_name,
            "aadhaar_masked": v.aadhaar_masked,
            "note": "Identity Verified via DigiLocker (Simulated for Demo)"}