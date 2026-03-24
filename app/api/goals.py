"""Goal endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.dependencies import set_audit_user
from app.middleware.auth import AuthenticatedUser
from app.models.enums import PatientPhase
from app.models.goal import Goal
from app.models.patient import Patient
from app.services.followup_service import schedule_followups
from app.services.phase_machine import PhaseStateMachine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/goals", tags=["goals"])


class GoalResponse(BaseModel):
    id: int
    patient_id: int
    raw_text: str
    structured_goal: dict | None = None
    confirmed: bool
    created_at: datetime


@router.post("/{goal_id}/confirm", response_model=GoalResponse)
async def confirm_goal(
    goal_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> GoalResponse:
    """Mark a goal as confirmed and transition patient to ACTIVE phase.

    Also schedules Day 2, 5, 7 follow-up check-ins.
    """
    result = await session.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.confirmed = True
    session.add(goal)
    await session.commit()
    await session.refresh(goal)

    # Transition patient from ONBOARDING → ACTIVE via state machine
    patient_result = await session.execute(
        select(Patient).where(Patient.id == goal.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if patient and patient.phase == PatientPhase.ONBOARDING:
        try:
            machine = PhaseStateMachine(session)
            await machine.transition(patient.id, PatientPhase.ACTIVE)
        except Exception:
            logger.warning("Phase transition ONBOARDING→ACTIVE failed for patient %s", patient.id)

    # Schedule Day 2, 5, 7 follow-up check-ins
    if patient:
        try:
            await schedule_followups(
                session, patient.id, onboarding_completed_at=now,
            )
        except Exception:
            logger.exception("Failed to schedule follow-ups for patient %s", patient.id)

    return GoalResponse(
        id=goal.id,
        patient_id=goal.patient_id,
        raw_text=goal.raw_text,
        structured_goal=goal.structured_goal,
        confirmed=goal.confirmed,
        created_at=goal.created_at,
    )
