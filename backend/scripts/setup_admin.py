"""
setup_admin.py — First-time Super Admin setup for ForenSync Cyber Portal
========================================================================
Run this ONCE after setting up your Firebase project to create the
Super Admin account in both Firebase Auth and Cloud Firestore.

Usage:
  1. Ensure firebase-service-account.json is in backend/ directory
  2. From the backend/ directory run:
        python scripts/setup_admin.py

Requirements: firebase-admin>=6.0.0  (pip install firebase-admin)
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    import firebase_admin
    from firebase_admin import credentials, auth, firestore
except ImportError:
    print("ERROR: firebase-admin is not installed.")
    print("Run: pip install firebase-admin")
    sys.exit(1)

SA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "firebase-service-account.json")

if not os.path.exists(SA_FILE):
    print(f"ERROR: Service account file not found at:\n  {SA_FILE}")
    print("\nDownload it from Firebase Console → Project Settings → Service Accounts → Generate new private key")
    sys.exit(1)

cred = credentials.Certificate(SA_FILE)
firebase_admin.initialize_app(cred)
db = firestore.client()

# ── Collect admin details ──────────────────────────────────────
print("\n=== ForenSync — Super Admin Setup ===\n")
admin_name  = input("Admin Full Name   : ").strip()
admin_email = input("Admin Email       : ").strip()
admin_pass  = input("Admin Password    : ").strip()

if not all([admin_name, admin_email, admin_pass]):
    print("ERROR: All fields are required.")
    sys.exit(1)

if len(admin_pass) < 8:
    print("ERROR: Password must be at least 8 characters.")
    sys.exit(1)

# ── Create Firebase Auth user ─────────────────────────────────
print("\n[1/3] Creating Firebase Auth account...")
try:
    user_record = auth.create_user(
        email=admin_email,
        password=admin_pass,
        display_name=admin_name,
        disabled=False
    )
    print(f"      ✅ Created: {user_record.uid}")
except Exception as e:
    if "EMAIL_EXISTS" in str(e) or "email-already-exists" in str(e).lower():
        print("      ℹ️  Auth user already exists — fetching UID...")
        user_record = auth.get_user_by_email(admin_email)
        print(f"      UID: {user_record.uid}")
    else:
        print(f"      ❌ ERROR: {e}")
        sys.exit(1)

# ── Create Firestore user profile ─────────────────────────────
print("[2/3] Writing Firestore /users/{uid} document...")
try:
    db.collection("users").document(user_record.uid).set({
        "uid":        user_record.uid,
        "name":       admin_name,
        "email":      admin_email,
        "role":       "super_admin",
        "branchId":   None,
        "branchName": None,
        "desk":       None,
        "status":     "active",
        "createdAt":  firestore.SERVER_TIMESTAMP,
    }, merge=True)
    print("      ✅ Firestore profile created")
except Exception as e:
    print(f"      ❌ ERROR: {e}")
    sys.exit(1)

# ── Verify ────────────────────────────────────────────────────
print("[3/3] Verifying setup...")
doc = db.collection("users").document(user_record.uid).get()
if doc.exists and doc.to_dict().get("role") == "super_admin":
    print("      ✅ Verification passed\n")
else:
    print("      ⚠️  Verification failed — check Firestore manually\n")

print("=" * 42)
print("✅ Super Admin setup complete!")
print(f"   UID   : {user_record.uid}")
print(f"   Email : {admin_email}")
print(f"   Name  : {admin_name}")
print(f"   Role  : super_admin")
print("=" * 42)
print("\nYou can now log in to the Admin Control Center at /admin")
print("with these credentials.\n")
