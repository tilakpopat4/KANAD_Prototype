"""schemas.py — request/response models with OWASP password policy."""
import re
from pydantic import BaseModel, EmailStr, field_validator, Field


class CitizenRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)  # OWASP: min 12, allow long
    full_name: str = Field(min_length=2, max_length=120)
    phone: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        # OWASP: check complexity + block obvious weak patterns
        if not re.search(r"[A-Z]", v): raise ValueError("Must contain an uppercase letter")
        if not re.search(r"[a-z]", v): raise ValueError("Must contain a lowercase letter")
        if not re.search(r"\d", v):    raise ValueError("Must contain a digit")
        if not re.search(r"[^\w\s]", v): raise ValueError("Must contain a special character")
        common = {"password", "12345678", "qwerty", "admin123", "password123"}
        if v.lower() in common: raise ValueError("Password is too common")
        return v

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, v: str) -> str:
        if not re.fullmatch(r"[6-9]\d{9}", v):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MobileOtpRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=10)

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, v: str) -> str:
        if not re.fullmatch(r"[6-9]\d{9}", v):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return v


class MobileOtpVerify(BaseModel):
    phone: str = Field(min_length=10, max_length=10)
    otp: str = Field(min_length=6, max_length=6)

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, v: str) -> str:
        if not re.fullmatch(r"[6-9]\d{9}", v):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MobileOtpResponse(BaseModel):
    message: str
    expires_in: int = 300  # 5 minutes


class MobileOtpVerifyResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict