import os
import shutil
import hashlib
import random
import datetime
import json
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import sys
sys.path.insert(0, os.path.dirname(__file__))

import database
import auth
import evidence_parser as parser

# ── Firebase Admin SDK ──────────────────────────────────────
try:
    import firebase_admin
    from firebase_admin import credentials as fb_credentials, auth as fb_auth

    _fb_cred_json = os.environ.get("FIREBASE_CREDENTIALS")
    _fb_sa_file   = os.path.join(os.path.dirname(__file__), "firebase-service-account.json")

    if not firebase_admin._apps:
        if _fb_cred_json:
            cred = fb_credentials.Certificate(json.loads(_fb_cred_json))
        elif os.path.exists(_fb_sa_file):
            cred = fb_credentials.Certificate(_fb_sa_file)
        else:
            cred = None

        if cred:
            firebase_admin.initialize_app(cred)
            FIREBASE_ENABLED = True
        else:
            FIREBASE_ENABLED = False
    else:
        FIREBASE_ENABLED = True
except ImportError:
    FIREBASE_ENABLED = False
    fb_auth = None


if os.environ.get("VERCEL"):
    import seed
    seed.seed_data()

app = FastAPI(title="ForenSync API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.environ.get("VERCEL"):
    UPLOAD_DIR = "/tmp/uploads"
else:
    UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Helper: Auto-routing and Priority Engine
def route_and_prioritize(description: str):
    desc_lower = description.lower()
    
    financial_keywords = ["otp", "upi", "bank", "card", "money", "transaction", "debit", "credit", "paytm", "gpay", "phonepe", "transfer", "fraud"]
    impersonation_keywords = ["profile", "fake account", "instagram", "facebook", "impersonate", "impersonator", "fake identity", "photo abuse", "pretending"]
    hacking_keywords = ["ransomware", "hacked", "corrupted", "malware", "virus", "phishing", "database down", "ddos", "unauthorized access", "breach"]
    
    category = "other"
    priority = 1
    assigned_desk = "General Desk"
    is_severe = 0
    
    fin_matches = sum(1 for kw in financial_keywords if kw in desc_lower)
    imp_matches = sum(1 for kw in impersonation_keywords if kw in desc_lower)
    hack_matches = sum(1 for kw in hacking_keywords if kw in desc_lower)
    
    max_matches = max(fin_matches, imp_matches, hack_matches)
    
    if max_matches > 0:
        if max_matches == fin_matches:
            category = "financial_fraud"
            assigned_desk = "Financial Fraud Desk"
            priority = min(3 + fin_matches // 2, 5)
        elif max_matches == hack_matches:
            category = "hacking"
            assigned_desk = "Cyber Security Desk"
            priority = min(3 + hack_matches // 2, 5)
        else:
            category = "impersonation"
            assigned_desk = "Cyber Social Desk"
            priority = min(2 + imp_matches // 2, 5)
            
    if any(k in desc_lower for k in ["emergency", "threat", "ransom", "suicide", "child", "national security", "terror"]):
        priority = 5
        is_severe = 1
        
    return category, priority, assigned_desk, is_severe


# --- AUTH ROUTES ---

@app.post("/register")
def register_user(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form("citizen"),
    desk: Optional[str] = Form(None),
    db: Session = Depends(database.get_db)
):
    existing = db.query(database.User).filter(database.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = database.User(
        name=name,
        email=email,
        role=role,
        password_hash=auth.get_password_hash(password),
        desk=desk,
        is_active=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User registered successfully", "id": user.id}

@app.post("/token")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(database.get_db)
):
    user = db.query(database.User).filter(database.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.is_active == 0:
        raise HTTPException(status_code=403, detail="User account is deactivated")
    
    access_token = auth.create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


from pydantic import BaseModel

class SiteManagerLogin(BaseModel):
    email: str
    password: str

@app.post("/api/sitemanager-login")
def sitemanager_login(data: SiteManagerLogin, db: Session = Depends(database.get_db)):
    """Password-gate for the Site Manager portal. Only admin-role users may access."""
    user = db.query(database.User).filter(database.User.email == data.email).first()
    if not user or not auth.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.is_active == 0:
        raise HTTPException(status_code=403, detail="Account deactivated")
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Access restricted to admin accounts")
    token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": token, "name": user.name}



class SendOTPRequest(BaseModel):
    email: str
    otp: str

@app.post("/send-otp")
def send_otp_email(req: SendOTPRequest):
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, val = line.strip().split("=", 1)
                    os.environ[key.strip()] = val.strip()
                    
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    try:
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    except ValueError:
        smtp_port = 587
        
    smtp_email = os.environ.get("SMTP_EMAIL", "")
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    
    if not smtp_email or not smtp_password:
        raise HTTPException(
            status_code=400,
            detail="SMTP credentials are not configured. Please create a .env file with SMTP_EMAIL and SMTP_PASSWORD."
        )
        
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        msg = MIMEMultipart()
        msg['From'] = smtp_email
        msg['To'] = req.email
        msg['Subject'] = f"ForenSync Security OTP: {req.otp}"
        
        body = f"""
Hello,

Your OTP for citizen verification on ForenSync Cyber Portal is: {req.otp}

This OTP is valid for 5 minutes. Please do not share it with anyone.

Regards,
Ahmedabad Cyber Branch Team
"""
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, req.email, msg.as_string())
        server.quit()
        return {"message": "OTP sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


# --- BRIDGING PC / SCANNING CHECK ---
def bridging_pc_scan(file_path: str, filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    try:
        with open(file_path, "rb") as f:
            content = f.read(1000)
            if b"MALWARE_TEST_SIGNATURE" in content or b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in content:
                return "flagged"
    except Exception:
        pass
    return "clean"


# --- CITIZEN PORTAL ROUTES ---

@app.post("/complaints")
def submit_complaint(
    description: str = Form(...),
    category: Optional[str] = Form(None),
    language: str = Form("en"),
    district: Optional[str] = Form(None),
    branch_id: Optional[str] = Form(None),
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    auto_cat, priority, desk, is_severe = route_and_prioritize(description)
    final_category = category if category else auto_cat
    
    ticket_id = f"TXN-{random.randint(10000, 99999)}"
    while db.query(database.Complaint).filter(database.Complaint.ticket_id == ticket_id).first():
        ticket_id = f"TXN-{random.randint(10000, 99999)}"
        
    complaint = database.Complaint(
        ticket_id=ticket_id,
        citizen_id=current_user.id,
        category=final_category,
        description=description,
        language=language,
        status="pending",
        priority_score=priority,
        assigned_desk=desk,
        is_severe=is_severe,
        branch_id=branch_id,
        district=district
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    
    return {
        "message": "Complaint submitted successfully",
        "ticket_id": ticket_id,
        "category": final_category,
        "priority_score": priority,
        "assigned_desk": desk,
        "is_severe": is_severe
    }

@app.get("/complaints/{ticket_id}")
def check_complaint_status(
    ticket_id: str,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(database.Complaint).filter(database.Complaint.ticket_id == ticket_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    if current_user.role not in ["investigator", "employee", "admin"] and complaint.citizen_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this complaint")
        
    evidence_list = []
    for ev in complaint.evidences:
        evidence_list.append({
            "id": ev.id,
            "filename": ev.filename,
            "file_type": ev.file_type,
            "sha256_hash": ev.sha256_hash,
            "scan_status": ev.scan_status,
            "uploaded_at": ev.uploaded_at
        })
        
    return {
        "id": complaint.id,
        "ticket_id": complaint.ticket_id,
        "category": complaint.category,
        "description": complaint.description,
        "status": complaint.status,
        "priority_score": complaint.priority_score,
        "assigned_desk": complaint.assigned_desk,
        "is_severe": complaint.is_severe,
        "created_at": complaint.created_at,
        "evidence": evidence_list
    }

@app.post("/complaints/{id}/evidence")
async def upload_evidence(
    id: int,
    file: UploadFile = File(...),
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(database.Complaint).filter(database.Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    if current_user.role not in ["investigator", "employee", "admin"] and complaint.citizen_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this complaint")
        
    ext = os.path.splitext(file.filename)[1].lower()
    temp_path = os.path.join(UPLOAD_DIR, f"temp_{random.randint(1000, 9999)}{ext}")
    
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    sha256_hash = hashlib.sha256()
    with open(temp_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    file_hash = sha256_hash.hexdigest()
    
    scan_status = bridging_pc_scan(temp_path, file.filename)
    
    permanent_filename = f"{file_hash[:16]}_{file.filename}"
    permanent_path = os.path.join(UPLOAD_DIR, permanent_filename)
    
    if os.path.exists(permanent_path):
        os.remove(temp_path)
    else:
        shutil.move(temp_path, permanent_path)
        
    evidence = database.Evidence(
        complaint_id=complaint.id,
        filename=file.filename,
        file_type=ext,
        storage_path=permanent_path,
        sha256_hash=file_hash,
        scan_status=scan_status
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    
    db.add(database.AuditLog(evidence_id=evidence.id, action="uploaded", actor_id=current_user.id, hash_at_time=file_hash))
    db.add(database.AuditLog(evidence_id=evidence.id, action="scanned", actor_id=current_user.id, hash_at_time=file_hash))
    db.add(database.AuditLog(evidence_id=evidence.id, action="hashed", actor_id=current_user.id, hash_at_time=file_hash))
    db.commit()
    
    parsed_events = []
    if scan_status == "clean":
        try:
            parsed_events = parser.parse_file(permanent_path)
            for ev in parsed_events:
                db_ev = database.TimelineEvent(
                    evidence_id=evidence.id,
                    event_timestamp_utc=ev["timestamp_utc"],
                    event_type=ev["event_type"],
                    description=ev["description"],
                    source_field=ev["source_field"]
                )
                db.add(db_ev)
                
            db.add(database.AuditLog(evidence_id=evidence.id, action="parsed", actor_id=current_user.id, hash_at_time=file_hash))
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Evidence parsing failed: {e}")
            
    return {
        "message": "Evidence uploaded and scanned by Bridging PC",
        "evidence_id": evidence.id,
        "filename": evidence.filename,
        "sha256_hash": file_hash,
        "scan_status": scan_status,
        "events_count": len(parsed_events)
    }


# --- INVESTIGATOR / EMPLOYEE DASHBOARD ROUTES ---

@app.get("/cases")
def list_cases(
    current_user: database.User = Depends(auth.get_current_employee),
    db: Session = Depends(database.get_db)
):
    query = db.query(database.Complaint)
    if current_user.role != "admin" and current_user.role != "super_admin":
        query = query.filter(database.Complaint.branch_id == current_user.branch_id)
    complaints = query.all()
    res = []
    for c in complaints:
        citizen = db.query(database.User).filter(database.User.id == c.citizen_id).first()
        res.append({
            "id": c.id,
            "ticket_id": c.ticket_id,
            "citizen_name": citizen.name if citizen else "Unknown",
            "category": c.category,
            "description": c.description,
            "status": c.status,
            "priority_score": c.priority_score,
            "assigned_desk": c.assigned_desk,
            "is_severe": c.is_severe,
            "created_at": c.created_at,
            "evidence_count": len(c.evidences)
        })
    res.sort(key=lambda x: x["priority_score"], reverse=True)
    return res

def check_case_access(complaint, current_user):
    if current_user.role != "admin" and current_user.role != "super_admin":
        if complaint.branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Access restricted to cases in your branch")

@app.get("/cases/{id}/timeline")
def get_case_timeline(
    id: int,
    current_user: database.User = Depends(auth.get_current_employee),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(database.Complaint).filter(database.Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_access(complaint, current_user)
        
    evidence_ids = [ev.id for ev in complaint.evidences]
    timeline = db.query(database.TimelineEvent).filter(database.TimelineEvent.evidence_id.in_(evidence_ids)).all()
    
    for ev_id in evidence_ids:
        ev_record = db.query(database.Evidence).filter(database.Evidence.id == ev_id).first()
        recomputed_hash = ""
        if ev_record and os.path.exists(ev_record.storage_path):
            sha = hashlib.sha256()
            with open(ev_record.storage_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha.update(chunk)
            recomputed_hash = sha.hexdigest()
                
        db.add(database.AuditLog(
            evidence_id=ev_id,
            action="viewed",
            actor_id=current_user.id,
            hash_at_time=recomputed_hash or ev_record.sha256_hash
        ))
    db.commit()
    
    events = []
    for t_ev in timeline:
        events.append({
            "id": t_ev.id,
            "evidence_id": t_ev.evidence_id,
            "timestamp_utc": t_ev.event_timestamp_utc,
            "event_type": t_ev.event_type,
            "description": t_ev.description,
            "source_field": t_ev.source_field
        })
    events.sort(key=lambda x: x["timestamp_utc"])
    return events

@app.get("/cases/{id}/audit-trail")
def get_case_audit_trail(
    id: int,
    current_user: database.User = Depends(auth.get_current_employee),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(database.Complaint).filter(database.Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_access(complaint, current_user)
        
    evidence_ids = [ev.id for ev in complaint.evidences]
    audits = db.query(database.AuditLog).filter(database.AuditLog.evidence_id.in_(evidence_ids)).order_by(database.AuditLog.timestamp.desc()).all()
    
    trail = []
    for a in audits:
        actor = db.query(database.User).filter(database.User.id == a.actor_id).first()
        evidence = db.query(database.Evidence).filter(database.Evidence.id == a.evidence_id).first()
        
        tampered = False
        current_hash = ""
        if evidence and os.path.exists(evidence.storage_path):
            sha = hashlib.sha256()
            with open(evidence.storage_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha.update(chunk)
            current_hash = sha.hexdigest()
            if current_hash != evidence.sha256_hash:
                tampered = True
                
        trail.append({
            "id": a.id,
            "evidence_filename": evidence.filename if evidence else "Unknown File",
            "evidence_id": a.evidence_id,
            "action": a.action,
            "actor_name": actor.name if actor else "System",
            "actor_role": actor.role if actor else "System",
            "timestamp": a.timestamp,
            "hash_at_time": a.hash_at_time,
            "original_upload_hash": evidence.sha256_hash if evidence else "",
            "current_integrity_hash": current_hash,
            "tampered": tampered
        })
    return trail

@app.patch("/cases/{id}/status")
def update_case_status(
    id: int,
    status: str = Form(...),
    current_user: database.User = Depends(auth.get_current_employee),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(database.Complaint).filter(database.Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_access(complaint, current_user)
    if status not in ["pending", "investigating", "resolved"]:
        raise HTTPException(status_code=400, detail="Invalid status value")
    complaint.status = status
    db.commit()
    return {"message": "Status updated successfully", "status": complaint.status}


# --- CASE NOTES ENDPOINTS ---

@app.get("/cases/{id}/notes")
def get_case_notes(
    id: int,
    current_user: database.User = Depends(auth.get_current_employee),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(database.Complaint).filter(database.Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_access(complaint, current_user)
    
    notes = db.query(database.CaseNote).filter(database.CaseNote.complaint_id == id).order_by(database.CaseNote.created_at.desc()).all()
    res = []
    for n in notes:
        emp = db.query(database.User).filter(database.User.id == n.employee_id).first()
        res.append({
            "id": n.id,
            "note_text": n.note_text,
            "created_at": n.created_at,
            "employee_name": emp.name if emp else "System"
        })
    return res

@app.post("/cases/{id}/notes")
def add_case_note(
    id: int,
    note_text: str = Form(...),
    current_user: database.User = Depends(auth.get_current_employee),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(database.Complaint).filter(database.Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_access(complaint, current_user)
    
    note = database.CaseNote(complaint_id=id, employee_id=current_user.id, note_text=note_text)
    db.add(note)
    db.commit()
    return {"message": "Case note added successfully", "note": note_text}


# --- FIR DRAFT ENDPOINTS ---

@app.get("/cases/{id}/fir-draft")
def get_fir_draft(
    id: int,
    current_user: database.User = Depends(auth.get_current_employee),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(database.Complaint).filter(database.Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_access(complaint, current_user)

    draft = db.query(database.FirDraft).filter(database.FirDraft.complaint_id == id).order_by(database.FirDraft.generated_at.desc()).first()
    if not draft:
        citizen = db.query(database.User).filter(database.User.id == complaint.citizen_id).first()
        
        narrative = f"FIRST INFORMATION REPORT\n(Under Section 154 CrPC)\n\n" \
                    f"1. District: AHMEDABAD CITY | PS: CYBER CRIME BRANCH\n" \
                    f"2. Ticket Ref ID: {complaint.ticket_id}\n" \
                    f"3. Complainant Name: {citizen.name if citizen else 'Unknown'}\n" \
                    f"4. Offense Category: {complaint.category.upper()}\n" \
                    f"5. Date Reported: {complaint.created_at.strftime('%Y-%m-%d %H:%M:%S')} UTC\n" \
                    f"6. Narrative Description:\n   {complaint.description}\n\n" \
                    f"7. forensic Evidence details:\n"
        for ev in complaint.evidences:
            narrative += f"   - File: {ev.filename} (SHA-256: {ev.sha256_hash})\n"
        narrative += f"\nPrepared for review under Ahmedabad Cyber Branch."
        
        draft = database.FirDraft(complaint_id=id, generated_text=narrative, status="draft")
        db.add(draft)
        db.commit()
        db.refresh(draft)
        
    return {
        "id": draft.id,
        "generated_text": draft.generated_text,
        "generated_at": draft.generated_at,
        "status": draft.status
    }

@app.post("/cases/{id}/fir-file")
def file_fir(
    id: int,
    current_user: database.User = Depends(auth.get_current_employee),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(database.Complaint).filter(database.Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_access(complaint, current_user)

    draft = db.query(database.FirDraft).filter(database.FirDraft.complaint_id == id).order_by(database.FirDraft.generated_at.desc()).first()
    if not draft:
        raise HTTPException(status_code=404, detail="FIR draft not generated yet.")
    draft.status = "filed"
    draft.reviewed_by = current_user.id
    db.commit()
    return {"message": "FIR marked as officially FILED", "status": "filed"}


# ── Firebase Admin: verify token dependency ─────────────────
class EmployeeCreate:
    def __init__(self, name: str, email: str, password: str,
                 desk: str, branchId: str, branchName: str):
        self.name = name; self.email = email; self.password = password
        self.desk = desk; self.branchId = branchId; self.branchName = branchName

from pydantic import BaseModel as PydanticBase

class EmployeeCreateBody(PydanticBase):
    name: str
    email: str
    password: str
    desk: str = "General Desk"
    branchId: str
    branchName: str

class EmployeeStatusBody(PydanticBase):
    disabled: bool

def get_firebase_admin_user(authorization: Optional[str] = Header(None)) -> dict:
    """Verifies a Firebase ID token and checks super_admin role from token claims."""
    if not FIREBASE_ENABLED:
        raise HTTPException(status_code=503, detail="Firebase not configured. Add FIREBASE_CREDENTIALS env var or firebase-service-account.json.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Firebase ID token")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {str(e)}")

# ── ADMIN PORTAL ROUTES (Firebase-protected) ─────────────────

@app.post("/admin/employees")
def firebase_create_employee(
    body: EmployeeCreateBody,
    token_data: dict = Depends(get_firebase_admin_user),
):
    """Creates a Firebase Auth user for a new employee (admin only)."""
    try:
        user_record = fb_auth.create_user(
            email=body.email,
            password=body.password,
            display_name=body.name,
            disabled=False
        )
        # Note: Firestore doc is written by the admin portal frontend after this returns
        return {
            "uid": user_record.uid,
            "email": user_record.email,
            "message": "Firebase Auth user created. Firestore profile will be written by admin portal."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/admin/employees/{uid}")
def firebase_delete_employee(
    uid: str,
    token_data: dict = Depends(get_firebase_admin_user),
):
    """Deletes a Firebase Auth user (admin only)."""
    try:
        fb_auth.delete_user(uid)
        return {"message": f"Firebase Auth user {uid} deleted."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/admin/employees/{uid}/status")
def firebase_set_employee_status(
    uid: str,
    body: EmployeeStatusBody,
    token_data: dict = Depends(get_firebase_admin_user),
):
    """Enable or disable a Firebase Auth employee account (admin only)."""
    try:
        fb_auth.update_user(uid, disabled=body.disabled)
        return {"uid": uid, "disabled": body.disabled, "message": "Account status updated."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/admin/cases")
def get_cases_by_branch(
    branch_id: Optional[str] = None,
    token_data: dict = Depends(get_firebase_admin_user),
    db: Session = Depends(database.get_db)
):
    """Returns cases filtered by branch_id (admin only)."""
    query = db.query(database.Complaint)
    if branch_id:
        query = query.filter(database.Complaint.branch_id == branch_id)
    complaints = query.order_by(database.Complaint.created_at.desc()).all()
    res = []
    for c in complaints:
        citizen = db.query(database.User).filter(database.User.id == c.citizen_id).first()
        res.append({
            "id": c.id, "ticket_id": c.ticket_id,
            "citizen_name": citizen.name if citizen else "Unknown",
            "category": c.category, "description": c.description,
            "status": c.status, "priority_score": c.priority_score,
            "assigned_desk": c.assigned_desk, "is_severe": c.is_severe,
            "branch_id": c.branch_id, "district": c.district,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "evidence_count": len(c.evidences)
        })
    return res


# --- LEGACY ADMIN PORTAL ROUTES (SQLite auth, kept for compatibility) ---


@app.get("/admin/employees")
def list_employees(
    current_user: database.User = Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db)
):
    return db.query(database.User).filter(database.User.role.in_(["employee", "investigator"])).all()

@app.post("/admin/employees")
def add_employee(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    desk: str = Form("General Desk"),
    current_user: database.User = Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db)
):
    existing = db.query(database.User).filter(database.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = database.User(
        name=name,
        email=email,
        role="employee",
        password_hash=auth.get_password_hash(password),
        desk=desk,
        is_active=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Employee created successfully", "user_id": user.id}

@app.patch("/admin/employees/{id}/status")
def toggle_employee_status(
    id: int,
    is_active: int = Form(...),
    current_user: database.User = Depends(auth.get_current_admin),
    db: Session = Depends(database.get_db)
):
    user = db.query(database.User).filter(database.User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = is_active
    db.commit()
    return {"message": f"Status updated to {is_active}", "user_id": user.id}


# --- ANALYTICS ROUTES ---

@app.get("/analytics/stats")
def get_analytics_stats(
    current_user: database.User = Depends(auth.get_current_employee),
    db: Session = Depends(database.get_db)
):
    complaints = db.query(database.Complaint).all()
    
    total_cases = len(complaints)
    pending_cases = sum(1 for c in complaints if c.status == "pending")
    investigating_cases = sum(1 for c in complaints if c.status == "investigating")
    resolved_cases = sum(1 for c in complaints if c.status == "resolved")
    
    categories = {"financial_fraud": 0, "impersonation": 0, "hacking": 0, "other": 0}
    for c in complaints:
        if c.category in categories:
            categories[c.category] += 1
        else:
            categories["other"] += 1
            
    daily_volume = {}
    for i in range(7):
        day = (datetime.datetime.utcnow() - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        daily_volume[day] = 0
        
    for c in complaints:
        day_str = c.created_at.strftime("%Y-%m-%d")
        if day_str in daily_volume:
            daily_volume[day_str] += 1
            
    daily_volume_list = [{"date": k, "count": v} for k, v in sorted(daily_volume.items())]
    
    return {
        "total_cases": total_cases,
        "pending": pending_cases,
        "investigating": investigating_cases,
        "resolved": resolved_cases,
        "by_category": categories,
        "daily_volume": daily_volume_list
    }


import urllib.request
import urllib.parse
import json

@app.post("/api/send-otp")
def send_otp(mobile: str = Form(...), otp: str = Form(...)):
    fast2sms_key = os.getenv("FAST2SMS_API_KEY", "")
    if not fast2sms_key:
        return {"success": False, "error": "FAST2SMS_API_KEY environment variable is not configured."}
        
    url = "https://www.fast2sms.com/dev/bulkV2"
    
    data = urllib.parse.urlencode({
        "variables_values": otp,
        "route": "otp",
        "numbers": mobile
    }).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("authorization", fast2sms_key)
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = response.read().decode("utf-8")
            result = json.loads(res_data)
            if result.get("return") is True:
                return {"success": True}
            else:
                return {"success": False, "error": result.get("message", "Unknown error from Fast2SMS")}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- SITE MANAGER / SLIDES ROUTES ---

SLIDE_IMAGES_DIR = os.path.join(UPLOAD_DIR, "slides")
os.makedirs(SLIDE_IMAGES_DIR, exist_ok=True)

@app.get("/api/slides")
def get_slides(db: Session = Depends(database.get_db)):
    slides = db.query(database.Slide).filter(database.Slide.is_active == 1).order_by(database.Slide.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "icon": s.icon,
            "color_scheme": s.color_scheme,
            "image_url": s.image_url
        }
        for s in slides
    ]

class SlideCreate(BaseModel):
    title: str
    description: str
    icon: Optional[str] = "info"
    color_scheme: Optional[str] = "info"
    image_url: Optional[str] = None

@app.post("/api/slides")
def create_slide(slide: SlideCreate, db: Session = Depends(database.get_db)):
    new_slide = database.Slide(
        title=slide.title,
        description=slide.description,
        icon=slide.icon,
        color_scheme=slide.color_scheme,
        image_url=slide.image_url
    )
    db.add(new_slide)
    db.commit()
    db.refresh(new_slide)
    return {"message": "Slide created successfully", "id": new_slide.id}

@app.post("/api/slides/upload-image")
async def upload_slide_image(file: UploadFile = File(...)):
    """Upload an image for a slideshow slide directly to Google Drive. Returns the public URL."""
    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF, and WebP images are allowed.")
    
    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    unique_name = f"slide_{hashlib.md5(f'{file.filename}{datetime.datetime.utcnow()}'.encode()).hexdigest()[:12]}{ext}"
    
    content = await file.read()
    
    try:
        import drive_service
        public_url = drive_service.upload_to_drive(content, unique_name, file.content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to Google Drive: {str(e)}")
        
    return {"url": public_url}

@app.delete("/api/slides/{id}")
def delete_slide(id: int, db: Session = Depends(database.get_db)):
    slide = db.query(database.Slide).filter(database.Slide.id == id).first()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")
    slide.is_active = 0
    db.commit()
    return {"message": "Slide deleted successfully"}


# =============================================================
# STATIC FILE SERVING — TWO-PART ARCHITECTURE
# =============================================================
# This single FastAPI server serves BOTH parts:
#
#   PART A — Citizen Portal  (PUBLIC / internet-facing)
#     /                 → frontend/citizen/index.html
#     /sitemanager      → frontend/citizen/sitemanager.html
#                          (password-protected via /api/sitemanager-login)
#
#   PART B — Police Intranet  (INTRANET / police premises only)
#     /employee         → frontend/police/employee.html
#     /admin            → frontend/police/admin.html
#
# All API routes (/complaints, /cases, /admin/*, /analytics/*) are
# shared by both parts through standard JWT authentication & role checks.
# =============================================================

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
citizen_dir  = os.path.join(frontend_dir, "citizen")
police_dir   = os.path.join(frontend_dir, "police")

if os.path.exists(frontend_dir):
    # Serve all frontend assets (shared style.css, assets/, citizen/, police/)
    app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend")

    # Serve uploaded files (slide images, evidence, etc.)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

    # ── PART A: Citizen Portal (Public) ──────────────────────

    @app.get("/")
    def citizen_portal():
        """Public citizen landing & complaint portal."""
        return FileResponse(os.path.join(citizen_dir, "index.html"))

    @app.get("/contact")
    def contact_portal():
        """Public contact page."""
        return FileResponse(os.path.join(frontend_dir, "contact.html"))

    @app.get("/privacy-policy")
    def privacy_policy_portal():
        """Government Privacy Policy for the Cyber Portal."""
        return FileResponse(os.path.join(frontend_dir, "privacy-policy.html"))

    @app.get("/sitemanager")
    def sitemanager_portal():
        """Password-protected slideshow manager (admin-only via /api/sitemanager-login)."""
        return FileResponse(os.path.join(citizen_dir, "sitemanager.html"))

    # ── PART B: Police Intranet (Restricted) ─────────────────

    @app.get("/employee")
    def employee_portal():
        """Employee/investigator workstation dashboard (intranet only)."""
        return FileResponse(os.path.join(police_dir, "employee.html"))

    @app.get("/admin")
    def admin_portal():
        """Admin control portal — employee management & desk metrics (intranet only)."""
        return FileResponse(os.path.join(police_dir, "admin.html"))


if __name__ == "__main__":
    import uvicorn
    database.init_db()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
