"""
models.py — 7-step fraud complaint (Steps 1-6 built; Step 7 signature/DigiLocker hooks reserved).
Parent complaint + two repeatable child tables (transactions, subjects).
"""
import datetime, secrets
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from api.database.database import Base


def gen_ref():
    return "FRAUD-" + datetime.datetime.utcnow().strftime("%Y") + "-" + secrets.token_hex(4).upper()


class FraudComplaint(Base):
    __tablename__ = "fraud_complaints"
    id = Column(Integer, primary_key=True, index=True)
    reference_id = Column(String, unique=True, index=True, default=gen_ref)

    # --- Step 1: Who is filing ---
    filer_is_complainant = Column(Boolean, nullable=False)   # "Were you the one affected?"
    filer_name = Column(String, nullable=False)
    filer_business_name = Column(String, nullable=True)
    filer_phone = Column(String, nullable=False)
    filer_email = Column(String, nullable=False)

    # --- Step 2: Complainant ---
    complainant_name = Column(String, nullable=False)
    complainant_age = Column(String, nullable=True)          # age range/select
    is_minor = Column(Boolean, nullable=True)                # 17 or younger
    address = Column(String, nullable=False)
    address_2 = Column(String, nullable=True)
    suite_apt = Column(String, nullable=True)
    city = Column(String, nullable=False)
    county = Column(String, nullable=True)
    country = Column(String, nullable=False)
    state = Column(String, nullable=True)                    # required only if country has states
    zip_code = Column(String, nullable=False)
    complainant_phone = Column(String, nullable=False)
    complainant_email = Column(String, nullable=False)

    # Step 2: Business info (conditional)
    on_behalf_of_business = Column(Boolean, default=False)
    business_name = Column(String, nullable=True)            # required if on_behalf_of_business
    business_ops_impacted = Column(Boolean, nullable=True)   # required if on_behalf_of_business
    business_it_poc = Column(String, nullable=True)
    business_other_poc = Column(String, nullable=True)
    critical_infra_sector = Column(String, nullable=True)
    critical_infra_subsector = Column(String, nullable=True)

    # --- Step 3: money summary (transactions in child table) ---
    money_lost = Column(Boolean, default=False)
    total_loss_amount = Column(Float, nullable=True)         # INR, required if money_lost

    # --- Step 5: Incident description ---
    incident_description = Column(Text, nullable=False)      # 3500 char cap

    # --- Step 6: Other info ---
    technical_details = Column(Text, nullable=True)          # 5000
    other_witnesses = Column(Text, nullable=True)            # 1000
    reported_elsewhere = Column(Text, nullable=True)         # 1000
    is_update = Column(Boolean, default=False)
    previous_complaint_number = Column(String, nullable=True)  # required if is_update

    # --- Step 7 hooks (reserved, built later) ---
    digital_signature = Column(String, nullable=True)
    digilocker_verified = Column(Boolean, default=False)
    digilocker_txn_id = Column(String, nullable=True)

    # --- System ---
    status = Column(String, default="submitted")
    priority = Column(String, default="medium")
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)

    transactions = relationship("FraudTransaction", back_populates="complaint", cascade="all, delete-orphan")
    subjects = relationship("FraudSubject", back_populates="complaint", cascade="all, delete-orphan")


class FraudTransaction(Base):
    """Step 3 repeatable Transaction #N block."""
    __tablename__ = "fraud_transactions"
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("fraud_complaints.id"), nullable=False)

    transaction_type = Column(String, nullable=True)         # UPI / Bank Transfer / Card / ...
    money_sent = Column(Boolean, default=False)              # "Was the money sent or lost?"
    amount = Column(Float, nullable=True)                    # INR, required if money_sent
    transaction_date = Column(String, nullable=True)         # dd-mm-yyyy, required if money_sent
    contacted_bank = Column(Boolean, default=False)

    # UPI block
    upi_app = Column(String, nullable=True)
    utr_number = Column(String, nullable=True)               # 12-digit, exempt from bank-contact gate
    payer_vpa = Column(String, nullable=True)
    payee_vpa = Column(String, nullable=True)
    payer_bank_upi = Column(String, nullable=True)
    payee_bank_upi = Column(String, nullable=True)

    # Bank/Card block
    orig_bank_name = Column(String, nullable=True)
    orig_bank_branch = Column(String, nullable=True)
    orig_bank_city = Column(String, nullable=True)
    orig_ifsc = Column(String, nullable=True)                # 11-char alphanumeric
    orig_account_name = Column(String, nullable=True)
    orig_account_number = Column(String, nullable=True)
    recip_bank_name = Column(String, nullable=True)
    recip_bank_branch = Column(String, nullable=True)
    recip_bank_city = Column(String, nullable=True)
    recip_ifsc = Column(String, nullable=True)
    recip_account_name = Column(String, nullable=True)
    recip_account_number = Column(String, nullable=True)
    recip_card_last4 = Column(String, nullable=True)         # last 4 only — never full PAN/CVV

    # Non-applicable / additional
    swift_code = Column(String, nullable=True)
    crypto_wallet = Column(String, nullable=True)
    crypto_coin = Column(String, nullable=True)
    wallet_txn_id = Column(String, nullable=True)
    cheque_dd_number = Column(String, nullable=True)
    other_reference = Column(String, nullable=True)

    complaint = relationship("FraudComplaint", back_populates="transactions")


class FraudSubject(Base):
    """Step 4 repeatable Subject #N block — all optional."""
    __tablename__ = "fraud_subjects"
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("fraud_complaints.id"), nullable=False)

    name = Column(String, nullable=True)
    business_name = Column(String, nullable=True)
    address = Column(String, nullable=True)
    address_2 = Column(String, nullable=True)
    suite_apt = Column(String, nullable=True)
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website_social = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)

    complaint = relationship("FraudComplaint", back_populates="subjects")