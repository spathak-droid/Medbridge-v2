"""Goal endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.dependencies import require_consent, set_audit_user
from app.middleware.auth import AuthenticatedUser
from app.models.goal import Goal
from app.models.patient import Patient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/goals", tags=["goals"])


class GoalResponse(BaseModel):
    id: int
    patient_id: int
    raw_text: str
    structured_goal: dict | None = None
    confirmed: bool
    clinician_approved: bool = False
    clinician_rejected: bool = False
    rejection_reason: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class RejectGoalRequest(BaseModel):
    reason: str


@router.post("/{goal_id}/confirm", response_model=GoalResponse)
async def confirm_goal(
    goal_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> GoalResponse:
    """Patient confirms their goal.

    If the clinician has already approved it, transitions to ACTIVE.
    Otherwise, the goal waits for clinician approval.
    """
    result = await session.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    # Consent gate
    patient_result = await session.execute(
        select(Patient).where(Patient.id == goal.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    if patient:
        if not patient.logged_in:
            raise HTTPException(status_code=403, detail="Patient must be logged in")
        if not patient.consent_given:
            raise HTTPException(status_code=403, detail="Patient consent required for coaching")

    goal.confirmed = True
    session.add(goal)
    await session.commit()
    await session.refresh(goal)

    return GoalResponse(
        id=goal.id,
        patient_id=goal.patient_id,
        raw_text=goal.raw_text,
        structured_goal=goal.structured_goal,
        confirmed=goal.confirmed,
        clinician_approved=goal.clinician_approved,
        clinician_rejected=goal.clinician_rejected,
        rejection_reason=goal.rejection_reason,
        reviewed_at=goal.reviewed_at,
        created_at=goal.created_at,
    )


@router.post("/{goal_id}/approve", response_model=GoalResponse)
async def approve_goal(
    goal_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> GoalResponse:
    """Clinician approves a patient's goal.

    If the goal is also confirmed by the patient, transitions to ACTIVE
    and schedules follow-up check-ins.
    """
    result = await session.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.clinician_approved = True
    goal.reviewed_at = datetime.now(timezone.utc)
    session.add(goal)
    await session.commit()
    await session.refresh(goal)

    return GoalResponse(
        id=goal.id,
        patient_id=goal.patient_id,
        raw_text=goal.raw_text,
        structured_goal=goal.structured_goal,
        confirmed=goal.confirmed,
        clinician_approved=goal.clinician_approved,
        clinician_rejected=goal.clinician_rejected,
        rejection_reason=goal.rejection_reason,
        reviewed_at=goal.reviewed_at,
        created_at=goal.created_at,
    )


@router.post("/{goal_id}/reject", response_model=GoalResponse)
async def reject_goal(
    goal_id: int,
    body: RejectGoalRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> GoalResponse:
    """Clinician rejects a patient's goal with a reason."""
    result = await session.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.clinician_rejected = True
    goal.rejection_reason = body.reason
    goal.reviewed_at = datetime.now(timezone.utc)
    goal.confirmed = False  # Reset so patient can set a new goal
    session.add(goal)
    await session.commit()
    await session.refresh(goal)

    return GoalResponse(
        id=goal.id,
        patient_id=goal.patient_id,
        raw_text=goal.raw_text,
        structured_goal=goal.structured_goal,
        confirmed=goal.confirmed,
        clinician_approved=goal.clinician_approved,
        clinician_rejected=goal.clinician_rejected,
        rejection_reason=goal.rejection_reason,
        reviewed_at=goal.reviewed_at,
        created_at=goal.created_at,
    )
