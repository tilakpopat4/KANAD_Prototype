"""config.py — option sets for the frontend dropdowns, served from /config so UI stays in sync."""

TRANSACTION_TYPES = [   # UPI first — dominates Indian payment-fraud volume
    "UPI (Google Pay / PhonePe / Paytm / BHIM / other)",
    "Bank Transfer (IMPS / NEFT / RTGS)",
    "Debit Card/Credit Card",
    "Mobile Wallet (Paytm/Amazon Pay/Mobikwik)",
    "Cash", "Cryptocurrency/Crypto Exchange",
    "Cheque/Demand Draft", "International Wire Transfer (SWIFT)", "Other",
]

UPI_APPS = ["Google Pay", "PhonePe", "Paytm", "BHIM", "Amazon Pay", "WhatsApp Pay", "Other"]

# Country -> has states? (drives the conditional State field)
COUNTRIES = ["India", "United States", "United Kingdom", "UAE", "Canada", "Australia", "Other"]
COUNTRIES_WITH_STATES = ["India", "United States"]

# Dependent dropdown: sector -> subsectors
CRITICAL_INFRA = {
    "None/Unsure": [],
    "Energy": ["Power Grid", "Oil & Gas", "Renewables"],
    "Financial Services": ["Banking", "Payment Systems", "Insurance", "Capital Markets"],
    "Healthcare": ["Hospitals", "Pharma", "Medical Devices"],
    "Water": ["Water Supply", "Wastewater"],
    "Transportation": ["Railways", "Aviation", "Ports", "Roadways"],
    "IT": ["Data Centres", "Cloud Services", "Software"],
    "Communications": ["Telecom", "Internet Services", "Broadcasting"],
    "Government": ["Defence", "Public Administration", "Emergency Services"],
}