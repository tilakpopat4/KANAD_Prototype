import os
import datetime
import database
import auth
from parser import parse_file

def seed_data():
    database.init_db()
    db = database.SessionLocal()

    print("Seeding database...")

    # Clear existing data for fresh seed if needed, but in seed.py we check if users exist
    # Let's clean up existing tables to ensure no schema mismatch errors in demo
    db.execute(database.Base.metadata.tables['users'].delete())
    db.execute(database.Base.metadata.tables['complaints'].delete())
    db.execute(database.Base.metadata.tables['evidence'].delete())
    db.execute(database.Base.metadata.tables['timeline_events'].delete())
    db.execute(database.Base.metadata.tables['audit_log'].delete())
    db.execute(database.Base.metadata.tables['case_notes'].delete())
    db.execute(database.Base.metadata.tables['fir_drafts'].delete())
    db.commit()

    # 1. Create demo users
    citizen = database.User(
        name="Rajesh Patel",
        email="citizen@forensync.gov",
        role="citizen",
        password_hash=auth.get_password_hash("citizen123"),
        is_active=1
    )
    db.add(citizen)
    
    employee = database.User(
        name="Inspector Amit Shah",
        email="investigator@forensync.gov",
        role="employee",
        password_hash=auth.get_password_hash("investigator123"),
        desk="Financial Fraud Desk",
        is_active=1
    )
    db.add(employee)

    admin = database.User(
        name="ACP Ahmedabad",
        email="admin@forensync.gov",
        role="admin",
        password_hash=auth.get_password_hash("admin123"),
        is_active=1
    )
    db.add(admin)
    db.commit()
    db.refresh(citizen)
    db.refresh(employee)
    db.refresh(admin)
    print("Demo accounts seeded.")

    # 2. Seed complaints
    c1 = database.Complaint(
        ticket_id="TXN-90210",
        citizen_id=citizen.id,
        category="financial_fraud",
        description="Received an SMS request to update KYC for state bank. Clicked link and 50,000 INR was debited via UPI transaction. Please trace the account.",
        status="investigating",
        priority_score=4,
        assigned_desk="Financial Fraud Desk",
        is_severe=0,
        language="en",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=2)
    )
    
    c2 = database.Complaint(
        ticket_id="TXN-48392",
        citizen_id=citizen.id,
        category="impersonation",
        description="A fake Facebook profile has been created using my photos and full name. The impersonator is asking money from my friend list.",
        status="pending",
        priority_score=2,
        assigned_desk="Cyber Social Desk",
        is_severe=0,
        language="en",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
    )
    
    c3 = database.Complaint(
        ticket_id="TXN-11234",
        citizen_id=citizen.id,
        category="hacking",
        description="Our company database SQLite was corrupted and ransomware text file was left on desktop. Demanding 0.5 BTC. System is offline.",
        status="resolved",
        priority_score=5,
        assigned_desk="Cyber Security Desk",
        is_severe=1,
        language="en",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=4)
    )
    db.add_all([c1, c2, c3])
    db.commit()
    db.refresh(c1)
    db.refresh(c2)
    db.refresh(c3)
    print("Seed complaints created.")

    # 3. Associate evidence files
    mock_sqlite = "sample_data/mock_browser.sqlite"
    mock_evtx = "sample_data/security_sample.evtx"

    import hashlib
    def get_sha256(filepath):
        if not os.path.exists(filepath):
            with open(filepath, "w") as f:
                f.write("dummy content")
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            h.update(f.read())
        return h.hexdigest()

    hash_sqlite = get_sha256(mock_sqlite)
    hash_evtx = get_sha256(mock_evtx)

    ev1 = database.Evidence(
        complaint_id=c1.id,
        filename="mock_browser.sqlite",
        file_type=".sqlite",
        storage_path=mock_sqlite,
        sha256_hash=hash_sqlite,
        scan_status="clean",
        uploaded_at=datetime.datetime.utcnow() - datetime.timedelta(days=1, hours=22)
    )
    
    ev2 = database.Evidence(
        complaint_id=c3.id,
        filename="security_sample.evtx",
        file_type=".evtx",
        storage_path=mock_evtx,
        sha256_hash=hash_evtx,
        scan_status="clean",
        uploaded_at=datetime.datetime.utcnow() - datetime.timedelta(days=3, hours=20)
    )
    db.add_all([ev1, ev2])
    db.commit()
    db.refresh(ev1)
    db.refresh(ev2)
    print("Seed evidence files created and linked.")

    # 4. Generate audit log trails
    # ev1
    db.add(database.AuditLog(evidence_id=ev1.id, action="uploaded", actor_id=citizen.id, timestamp=ev1.uploaded_at, hash_at_time=hash_sqlite))
    db.add(database.AuditLog(evidence_id=ev1.id, action="scanned", actor_id=employee.id, timestamp=ev1.uploaded_at + datetime.timedelta(minutes=2), hash_at_time=hash_sqlite))
    db.add(database.AuditLog(evidence_id=ev1.id, action="hashed", actor_id=employee.id, timestamp=ev1.uploaded_at + datetime.timedelta(minutes=5), hash_at_time=hash_sqlite))
    db.add(database.AuditLog(evidence_id=ev1.id, action="parsed", actor_id=employee.id, timestamp=ev1.uploaded_at + datetime.timedelta(minutes=10), hash_at_time=hash_sqlite))
    # ev2
    db.add(database.AuditLog(evidence_id=ev2.id, action="uploaded", actor_id=citizen.id, timestamp=ev2.uploaded_at, hash_at_time=hash_evtx))
    db.add(database.AuditLog(evidence_id=ev2.id, action="scanned", actor_id=employee.id, timestamp=ev2.uploaded_at + datetime.timedelta(minutes=3), hash_at_time=hash_evtx))
    db.add(database.AuditLog(evidence_id=ev2.id, action="hashed", actor_id=employee.id, timestamp=ev2.uploaded_at + datetime.timedelta(minutes=5), hash_at_time=hash_evtx))
    db.add(database.AuditLog(evidence_id=ev2.id, action="parsed", actor_id=employee.id, timestamp=ev2.uploaded_at + datetime.timedelta(minutes=12), hash_at_time=hash_evtx))
    db.commit()

    # 5. Populate parsed timeline events
    events_sqlite = parse_file(mock_sqlite)
    for ev in events_sqlite:
        db_ev = database.TimelineEvent(
            evidence_id=ev1.id,
            event_timestamp_utc=ev["timestamp_utc"],
            event_type=ev["event_type"],
            description=ev["description"],
            source_field=ev["source_field"]
        )
        db.add(db_ev)

    events_evtx = parse_file(mock_evtx)
    for ev in events_evtx:
        db_ev = database.TimelineEvent(
            evidence_id=ev2.id,
            event_timestamp_utc=ev["timestamp_utc"],
            event_type=ev["event_type"],
            description=ev["description"],
            source_field=ev["source_field"]
        )
        db.add(db_ev)
    db.commit()
    print("Timeline events seeded.")

    # 6. Seed Case Notes
    note1 = database.CaseNote(
        complaint_id=c1.id,
        employee_id=employee.id,
        note_text="KYC update URL trace request sent to ISP. Waiting for response.",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
    )
    note2 = database.CaseNote(
        complaint_id=c1.id,
        employee_id=employee.id,
        note_text="IP address used for transaction located in Ahmedabad. Cyber squad dispatched for query.",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=5)
    )
    db.add_all([note1, note2])
    db.commit()
    print("Case notes seeded.")

    db.close()
    print("Database seeding completed.")

if __name__ == "__main__":
    seed_data()
