"""service.py — talks to Sandbox.co.in, or fabricates a labeled simulated identity for demos."""
import datetime
import httpx

from . import config
from .models import DigiLockerVerification


class DigiLockerService:

    # ---------- START a verification ----------
    @staticmethod
    def start(db, redirect_url: str):
        if config.PROVIDER == "sandbox":
            return DigiLockerService._start_sandbox(db, redirect_url)
        return DigiLockerService._start_simulated(db)

    @staticmethod
    def _start_sandbox(db, redirect_url):
        s = config.SANDBOX
        headers = {"Authorization": s["api_key"], "x-api-secret": s["api_secret"],
                   "Content-Type": "application/json"}
        payload = {"@entity": "in.co.sandbox.kyc.digilocker.session.request",
                   "flow": "signin", "doc_types": ["aadhaar"], "redirect_url": redirect_url}
        with httpx.Client(timeout=15) as client:
            r = client.post(s["base_url"] + s["init_path"], json=payload, headers=headers)
            r.raise_for_status()
            data = r.json().get("data", r.json())
        v = DigiLockerVerification(session_id=data["session_id"], status="initiated",
                                   provider="sandbox", is_simulated=False)
        db.add(v); db.commit(); db.refresh(v)
        return {"verify_token": v.verify_token,
                "authorization_url": data.get("authorization_url"),
                "simulated": False}

    @staticmethod
    def _start_simulated(db):
        import secrets
        v = DigiLockerVerification(session_id="SIM-" + secrets.token_hex(6), status="initiated",
                                   provider="simulated", is_simulated=True)
        db.add(v); db.commit(); db.refresh(v)
        # Frontend opens a DigiLocker-styled modal; any 6-digit OTP (e.g. 123456) will pass /simulate-complete
        return {"verify_token": v.verify_token,
                "authorization_url": f"/digilocker-sim?token={v.verify_token}",
                "simulated": True}

    # ---------- CHECK / COMPLETE ----------
    @staticmethod
    def poll_sandbox(db, v: DigiLockerVerification):
        s = config.SANDBOX
        headers = {"Authorization": s["api_key"], "x-api-secret": s["api_secret"]}
        with httpx.Client(timeout=15) as client:
            st = client.get(s["base_url"] + s["status_path"].format(sid=v.session_id), headers=headers)
            st.raise_for_status()
            status = st.json().get("data", {}).get("status", "").lower()
            if status in ("completed", "success", "verified"):
                doc = client.get(s["base_url"] + s["doc_path"].format(sid=v.session_id, doc_type="aadhaar"),
                                 headers=headers)
                doc.raise_for_status()
                d = doc.json().get("data", {})
                aadhaar = d.get("aadhaar_number", "")
                v.verified_name = d.get("name")
                v.verified_dob = d.get("date_of_birth")
                v.aadhaar_masked = ("XXXX-XXXX-" + aadhaar[-4:]) if aadhaar else None
                v.photo_url = d.get("photo")
                v.status = "verified"; v.verified_at = datetime.datetime.utcnow()
                db.commit()
        return v

    @staticmethod
    def complete_simulated(db, v: DigiLockerVerification, otp: str):
        # Accept any 6-digit OTP for the demo (spec: fake OTP passes)
        if not (otp and otp.isdigit() and len(otp) == 6):
            return None
        v.verified_name = "Demo Citizen (Simulated)"
        v.verified_dob = "01-01-1990"
        v.aadhaar_masked = "XXXX-XXXX-1234"
        v.photo_url = None
        v.status = "verified"; v.verified_at = datetime.datetime.utcnow()
        db.commit()
        return v

    # ---------- Validate a token before attaching to a complaint ----------
    @staticmethod
    def is_valid(v: DigiLockerVerification) -> bool:
        if not v or v.status != "verified" or v.consumed:
            return False
        age = datetime.datetime.utcnow() - (v.verified_at or v.created_at)
        return age.total_seconds() <= config.VERIFICATION_TTL_MINUTES * 60

    @staticmethod
    def consume_verification(db, verify_token: str) -> DigiLockerVerification:
        """Mark a verification as consumed (one-time use). Returns the verification or None."""
        v = db.query(DigiLockerVerification).filter(
            DigiLockerVerification.verify_token == verify_token
        ).first()
        if not v or v.status != "verified" or v.consumed:
            return None
        v.consumed = True
        db.commit()
        return v
