"""config.py — DigiLocker provider settings. Switch PROVIDER to go sandbox <-> simulated <-> production."""
import os

# "sandbox" = real Sandbox.co.in sandbox | "simulated" = offline demo fallback | "production" = official DigiLocker
PROVIDER = os.environ.get("DIGILOCKER_PROVIDER", "simulated")

SANDBOX = {
    "base_url": os.environ.get("SANDBOX_BASE_URL", "https://test-api.sandbox.co.in"),
    "api_key": os.environ.get("SANDBOX_API_KEY", ""),
    "api_secret": os.environ.get("SANDBOX_API_SECRET", ""),
    "init_path": "/kyc/digilocker/sessions/init",
    "status_path": "/kyc/digilocker/sessions/{sid}/status",
    "doc_path": "/kyc/digilocker/sessions/{sid}/documents/{doc_type}",
}

# Where DigiLocker redirects the citizen back to after consent+OTP
REDIRECT_URL = os.environ.get("DIGILOCKER_REDIRECT_URL", "http://localhost:8000/api/digilocker/callback")

# Verification is valid for this long before a fresh one is required (anti-replay)
VERIFICATION_TTL_MINUTES = 30