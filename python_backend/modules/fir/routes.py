"""routes.py — FIR (First Information Report) API Routes."""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.database.database import get_db
from api.modules.fir import models, schemas, config

router = APIRouter(prefix="/fir", tags=["FIR - First Information Report"])


@router.get("/config", response_model=schemas.FIRConfigResponse)
async def get_fir_config():
    """Get configuration data for FIR form dropdowns."""
    return schemas.FIRConfigResponse(
        districts=[{"code": d["code"], "name": d["name"]} for d in config.DISTRICTS_DATA],
        police_stations=[{"district_code": d["code"], "name": s}
                        for d in config.DISTRICTS_DATA for s in d["stations"]],
        incident_categories=config.INCIDENT_CATEGORIES,
        sex_options=config.SEX_OPTIONS,
        build_options=config.BUILD_OPTIONS,
        skin_colors=config.SKIN_COLORS,
        days_of_week=config.DAYS_OF_WEEK,
        injury_types=config.INJURY_TYPES
    )


PRIORITY_MAP = {
    "Theft": "medium", "Robbery/Dacoity": "high", "Burglary": "high",
    "Assault/Hurt": "high", "Murder/Attempt to Murder": "critical",
    "Kidnapping/Abduction": "critical", "Rape/Sexual Harassment": "critical",
    "Missing Person": "high", "Vehicle Theft": "medium", "Snatching": "medium",
}


@router.post("/", response_model=schemas.FIRComplaintResponse, status_code=201)
async def create_fir_complaint(complaint_data: schemas.FIRComplaintCreate, db: Session = Depends(get_db)):
    """Create a new FIR complaint based on NCRB I.I.F.-I schema."""
    if not complaint_data.declaration_true_to_knowledge:
        raise HTTPException(status_code=400, detail="Declaration required")

    priority = PRIORITY_MAP.get(complaint_data.incident_category_hint, "medium")

    # Create main complaint
    db_complaint = models.FIRComplaint(
        status="submitted", priority=priority,
        **complaint_data.model_dump(exclude={"accused_persons", "properties", "victims"})
    )

    db.add(db_complaint)
    db.flush()

    # Add accused persons
    for i, acc in enumerate(complaint_data.accused_persons):
        db.add(models.FIRAccusedPerson(fir_id=db_complaint.id, **acc.model_dump()))

    # Add properties
    for i, prop in enumerate(complaint_data.properties):
        db.add(models.FIRProperty(fir_id=db_complaint.id, **prop.model_dump()))

    # Add victims
    for i, vic in enumerate(complaint_data.victims):
        db.add(models.FIRVictim(fir_id=db_complaint.id, **vic.model_dump()))

    db.commit()
    db.refresh(db_complaint)
    return db_complaint


@router.get("/{reference_id}", response_model=schemas.FIRTrackResponse)
async def track_fir(reference_id: str, db: Session = Depends(get_db)):
    """Track FIR by reference ID."""
    comp = db.query(models.FIRComplaint).filter(models.FIRComplaint.reference_id == reference_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="FIR not found")
    return comp
