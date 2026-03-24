"""FastAPI dependencies for consent gating and authentication."""

from fastapi import Depends, HTTPException, Path, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import AuthenticatedUser, get_current_user
from app.models.patient import Patient
from app.services.consent_gate import ConsentError, ConsentGateService


async def require_consent(
    patient_id: int = Path(...),
    session: AsyncSession = Depends(get_session),
) -> bool:
    """FastAPI dependency that blocks requests when consent is missing.

    Raises HTTP 403 with a consent-related detail message.
    Short-circuits before any LLM or coach processing.
    """
    gate = ConsentGateService(session)
    try:
        return await gate.verify(patient_id)
    except ConsentError as exc:
        raise HTTPException(status_code=403, detail=f"Consent required: {exc.reason}")


async def set_audit_user(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Set user info on request state for audit logging, then return user."""
    request.state.user_uid = user.uid
    request.state.user_role = user.role
    return user


async def require_own_patient_data(
    patient_id: int = Path(...),
    user: AuthenticatedUser = Depends(set_audit_user),
    session: AsyncSession = Depends(get_session),
) -> AuthenticatedUser:
    """Ensure a patient can only access their own data.

    Clinicians can access any patient's data.
    Patients can only access data where patient.external_id matches their Firebase UID.
    """
    if user.role == "clinician":
        return user

    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient.external_id != user.uid:
        raise HTTPException(status_code=403, detail="Access denied — not your data")

    return user
