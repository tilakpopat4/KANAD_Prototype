"""main.py — Fraud complaint module entry point."""
from fastapi import FastAPI
from fruad_complaint.routes import router as fraud_router

app = FastAPI(title="Fraud Complaint Module")
app.include_router(fraud_router)
