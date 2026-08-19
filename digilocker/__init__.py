"""DigiLocker verification module for identity verification.

This module provides DigiLocker integration for verifying citizen identity
before submitting fraud complaints. It supports:
- Sandbox.co.in API for real DigiLocker verification
- Simulated mode for demo/testing (any 6-digit OTP works)

Usage:
    from digilocker.routes import router
    app.include_router(router)
"""

from .routes import router
from .service import DigiLockerService
from .models import DigiLockerVerification
from . import config

__all__ = ["router", "DigiLockerService", "DigiLockerVerification", "config"]
