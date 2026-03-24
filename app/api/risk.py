"""Risk scoring API endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import AuthenticatedUser, require_clinician
from app.services.risk_scoring import assess_all_patients_risk, assess_patient_risk

router = APIRouter(prefix="/api/patients", tags=["risk"])


class RiskAssessmentResponse(BaseModel):
    patient_id: int
    risk_level: str
    risk_score: int
    risk_factors: list[str]
    assessed_at: datetime


@router.get("/{patient_id}/risk", response_model=RiskAssessmentResponse)
async def get_patient_risk(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> RiskAssessmentResponse:
    """Get dropout risk assessment for a single patient."""
    try:
        assessment = await assess_patient_risk(session, patient_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Patient not found")

    return RiskAssessmentResponse(
        patient_id=assessment.patient_id,
        risk_level=assessment.risk_level.value,
        risk_score=assessment.risk_score,
        risk_factors=assessment.risk_factors,
        assessed_at=assessment.assessed_at,
    )


@router.get("/risk-scores", response_model=list[RiskAssessmentResponse])
async def get_all_risk_scores(
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> list[RiskAssessmentResponse]:
    """Get risk scores for all patients, sorted by score descending."""
    assessments = await assess_all_patients_risk(session)
    return [
        RiskAssessmentResponse(
            patient_id=a.patient_id,
            risk_level=a.risk_level.value,
            risk_score=a.risk_score,
            risk_factors=a.risk_factors,
            assessed_at=a.assessed_at,
        )
        for a in assessments
    ]
