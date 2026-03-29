"""Alert endpoints — TICKET-017."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import AuthenticatedUser, require_clinician
from app.models.alert import Alert
from app.models.enums import AlertStatus, AlertUrgency
from app.models.patient import Patient


def display_name(name: str) -> str:
    """Never show raw emails as patient names."""
    if '@' in name:
        return name.split('@')[0]
    return name

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

URGENCY_ORDER = {
    AlertUrgency.CRITICAL: 0,
    AlertUrgency.HIGH: 1,
    AlertUrgency.NORMAL: 2,
}

STATUS_ORDER = {
    AlertStatus.NEW: 0,
    AlertStatus.ACKNOWLEDGED: 1,
}


class AlertResponse(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    reason: str
    urgency: str
    status: str
    created_at: datetime
    acknowledged_at: datetime | None


@router.get("", response_model=list[AlertResponse])
async def get_alerts(
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> list[AlertResponse]:
    """Return all alerts sorted by urgency (CRITICAL first), status (NEW first), then recency."""
    urgency_sort = case(
        URGENCY_ORDER,
        value=Alert.urgency,
        else_=99,
    )
    status_sort = case(
        STATUS_ORDER,
        value=Alert.status,
        else_=99,
    )

    result = await session.execute(
        select(Alert, Patient.name)
        .join(Patient, Alert.patient_id == Patient.id)
        .order_by(urgency_sort, status_sort, Alert.created_at.desc())
    )
    rows = result.all()

    return [
        AlertResponse(
            id=alert.id,
            patient_id=alert.patient_id,
            patient_name=display_name(patient_name),
            reason=alert.reason,
            urgency=alert.urgency.value,
            status=alert.status.value,
            created_at=alert.created_at,
            acknowledged_at=alert.acknowledged_at,
        )
        for alert, patient_name in rows
    ]


@router.patch("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> AlertResponse:
    """Mark an alert as acknowledged."""
    result = await session.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()

    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Fetch patient name for response
    pat_result = await session.execute(select(Patient.name).where(Patient.id == alert.patient_id))
    patient_name = pat_result.scalar_one()

    if alert.status != AlertStatus.ACKNOWLEDGED:
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_at = datetime.now(timezone.utc)
        session.add(alert)
        await session.commit()
        await session.refresh(alert)

    return AlertResponse(
        id=alert.id,
        patient_id=alert.patient_id,
        patient_name=display_name(patient_name),
        reason=alert.reason,
        urgency=alert.urgency.value,
        status=alert.status.value,
        created_at=alert.created_at,
        acknowledged_at=alert.acknowledged_at,
    )
