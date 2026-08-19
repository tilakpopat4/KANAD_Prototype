"""schemas.py — nested submission model with the conditional-required rules from Steps 1-6."""
import re
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
UTR_RE = re.compile(r"^\d{12}$")


class TransactionIn(BaseModel):
    transaction_type: Optional[str] = None
    money_sent: bool = False
    amount: Optional[float] = Field(default=None, ge=0)
    transaction_date: Optional[str] = None
    contacted_bank: bool = False
    upi_app: Optional[str] = None
    utr_number: Optional[str] = None
    payer_vpa: Optional[str] = None
    payee_vpa: Optional[str] = None
    payer_bank_upi: Optional[str] = None
    payee_bank_upi: Optional[str] = None
    orig_bank_name: Optional[str] = None
    orig_bank_branch: Optional[str] = None
    orig_bank_city: Optional[str] = None
    orig_ifsc: Optional[str] = None
    orig_account_name: Optional[str] = None
    orig_account_number: Optional[str] = None
    recip_bank_name: Optional[str] = None
    recip_bank_branch: Optional[str] = None
    recip_bank_city: Optional[str] = None
    recip_ifsc: Optional[str] = None
    recip_account_name: Optional[str] = None
    recip_account_number: Optional[str] = None
    recip_card_last4: Optional[str] = Field(default=None, max_length=4)
    swift_code: Optional[str] = None
    crypto_wallet: Optional[str] = None
    crypto_coin: Optional[str] = None
    wallet_txn_id: Optional[str] = None
    cheque_dd_number: Optional[str] = None
    other_reference: Optional[str] = None

    @field_validator("utr_number")
    @classmethod
    def _utr(cls, v):
        if v and not UTR_RE.match(v): raise ValueError("UTR must be a 12-digit number")
        return v

    @field_validator("orig_ifsc", "recip_ifsc")
    @classmethod
    def _ifsc(cls, v):
        if v and not IFSC_RE.match(v.upper()): raise ValueError("Invalid IFSC (e.g. HDFC0001234)")
        return v.upper() if v else v

    @field_validator("recip_card_last4")
    @classmethod
    def _card(cls, v):
        if v and (not v.isdigit() or len(v) > 4):
            raise ValueError("Enter last 4 digits only — never the full card number or CVV")
        return v

    @model_validator(mode="after")
    def _money_sent_requirements(self):
        if self.money_sent:
            if self.amount is None: raise ValueError("Transaction amount required when money was sent")
            if not self.transaction_date: raise ValueError("Transaction date required when money was sent")
        return self


class SubjectIn(BaseModel):  # all optional (Step 4)
    name: Optional[str] = None
    business_name: Optional[str] = None
    address: Optional[str] = None
    address_2: Optional[str] = None
    suite_apt: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website_social: Optional[str] = None
    ip_address: Optional[str] = None


class FraudComplaintIn(BaseModel):
    # Step 1
    filer_is_complainant: bool
    filer_name: str
    filer_business_name: Optional[str] = None
    filer_phone: str
    filer_email: EmailStr
    # Step 2
    complainant_name: str
    complainant_age: Optional[str] = None
    is_minor: Optional[bool] = None
    address: str
    address_2: Optional[str] = None
    suite_apt: Optional[str] = None
    city: str
    county: Optional[str] = None
    country: str
    state: Optional[str] = None
    zip_code: str
    complainant_phone: str
    complainant_email: EmailStr
    on_behalf_of_business: bool = False
    business_name: Optional[str] = None
    business_ops_impacted: Optional[bool] = None
    business_it_poc: Optional[str] = None
    business_other_poc: Optional[str] = None
    critical_infra_sector: Optional[str] = None
    critical_infra_subsector: Optional[str] = None
    # Step 3
    money_lost: bool = False
    total_loss_amount: Optional[float] = Field(default=None, ge=0)
    transactions: List[TransactionIn] = []
    # Step 4
    subjects: List[SubjectIn] = []
    # Step 5
    incident_description: str = Field(max_length=3500)
    # Step 6
    technical_details: Optional[str] = Field(default=None, max_length=5000)
    other_witnesses: Optional[str] = Field(default=None, max_length=1000)
    reported_elsewhere: Optional[str] = Field(default=None, max_length=1000)
    is_update: bool = False
    previous_complaint_number: Optional[str] = None
    # Step 7 - Digital Signature / Identity Verification
    digilocker_verify_token: str  # Required: must be a verified, unconsumed token

    @model_validator(mode="after")
    def _conditionals(self):
        if self.on_behalf_of_business:
            if not self.business_name: raise ValueError("Business Name required when filing on behalf of a business")
            if self.business_ops_impacted is None: raise ValueError("Please indicate if operations are impacted")
        if self.money_lost and self.total_loss_amount is None:
            raise ValueError("Total loss amount required when money was lost")
        if self.is_update and not self.previous_complaint_number:
            raise ValueError("Previous Complaint/Report Number required for an update")
        return self


class FraudComplaintResponse(BaseModel):
    reference_id: str
    status: str
    priority: str
    total_loss_amount: Optional[float]
    transaction_count: int
    subject_count: int
    message: str
    # Step 7 - Identity Verification
    verified_identity: Optional[str] = None
    digilocker_verified: bool = False
    digilocker_txn_id: Optional[str] = None
