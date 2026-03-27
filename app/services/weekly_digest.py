"""Weekly progress digest service.

Generates personalized weekly summaries for patients showing their
exercise progress, streak, goal trajectory, and encouragement.
Combats "perceived ineffectiveness" — a top dropout driver.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventType, PatientPhase, ScheduleStatus
from app.models.goal import Goal
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent
from app.services.llm_provider import generate_llm_response
from app.services.safety_pipeline import run_safety_pipeline


# ---------------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------------


async def gather_weekly_data(
    session: AsyncSession,
    patient_id: int,
) -> dict:
    """Gather data needed for the weekly digest."""
    from app.data.adherence import get_adherence_for_patient

    result = await session.execute(
        select(Patient).where(Patient.id == patient_id)
    )
    patient = result.scalar_one_or_none()
    if patient is None:
        raise ValueError(f"Patient {patient_id} not found")

    # Goal
    goal_result = await session.execute(
        select(Goal).where(
            Goal.patient_id == patient_id,
            Goal.confirmed == True,  # noqa: E712
        ).order_by(Goal.created_at.desc())
    )
    goal = goal_result.scalar_one_or_none()

    # Adherence
    adh = get_adherence_for_patient(patient.external_id, patient.program_type)

    return {
        "patient_name": patient.name,
        "phase": patient.phase.value,
        "goal_text": goal.raw_text if goal else None,
        "adherence_pct": adh.get("adherence_percentage") if adh else None,
        "current_streak": adh.get("current_streak", 0) if adh else 0,
        "days_completed": adh.get("days_completed", 0) if adh else 0,
        "total_days": adh.get("total_days_in_program", 0) if adh else 0,
        "days_missed": adh.get("days_missed", 0) if adh else 0,
        "status": adh.get("status") if adh else None,
        "program_type": patient.program_type,
    }


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------


def build_digest_prompt(data: dict) -> str:
    """Build a prompt for generating a weekly progress digest."""
    goal = data.get("goal_text") or "your rehabilitation exercises"
    adherence_pct = data.get("adherence_pct")
    streak = data.get("current_streak", 0)
    days_completed = data.get("days_completed", 0)
    total_days = data.get("total_days", 0)
    status = (data.get("status") or "").upper()

    # Determine trend description
    if status == "HIGH" or (adherence_pct is not None and adherence_pct >= 80):
        trend = "improving"
    elif status == "DECLINING" or (adherence_pct is not None and adherence_pct < 40):
        trend = "declining"
    else:
        trend = "steady"

    prompt = (
        f"Generate a warm, personalized weekly progress digest for a rehabilitation patient.\n\n"
        f"Patient's goal: {goal}\n"
        f"Exercises completed this program: {days_completed}/{total_days} days\n"
        f"Current streak: {streak} days\n"
        f"Adherence: {adherence_pct:.0f}%\n" if adherence_pct is not None else
        f"Generate a warm, personalized weekly progress digest for a rehabilitation patient.\n\n"
        f"Patient's goal: {goal}\n"
        f"Exercises completed this program: {days_completed}/{total_days} days\n"
        f"Current streak: {streak} days\n"
        f"Adherence: No data yet\n"
    )

    prompt += (
        f"Trend: {trend}\n\n"
        f"Write a brief weekly summary (3-5 sentences) that includes:\n"
        f"1. What they accomplished this week\n"
        f"2. Their current streak and what it means\n"
        f"3. Goal progress narrative (how close they are)\n"
        f"4. Encouragement appropriate to their trend ({trend})\n"
        f"5. A brief preview of what to focus on next week\n\n"
        f"Be warm, specific, and motivating. Reference their actual numbers."
    )
    return prompt


# ---------------------------------------------------------------------------
# Digest generation
# ---------------------------------------------------------------------------

DIGEST_SYSTEM_PROMPT = (
    "You are a supportive rehabilitation coach writing a weekly progress digest. "
    "Write a warm, personalized summary in 3-5 sentences. "
    "Reference the patient's actual numbers (streak, adherence, days completed). "
    "Never provide medical advice, diagnoses, or medication recommendations. "
    "Focus on progress celebration and motivation for the coming week."
)


async def _generate_digest_message(
    prompt: str,
    *,
    patient_id: int,
    augmented_prompt: bool = False,
) -> str:
    """Generate a weekly digest message via LLM."""
    system = DIGEST_SYSTEM_PROMPT
    if augmented_prompt:
        from app.services.safety_pipeline import AUGMENTED_RETRY_INSTRUCTION
        system += f"\n\n{AUGMENTED_RETRY_INSTRUCTION}"

    return await generate_llm_response(
        messages=[{"role": "user", "content": prompt}],
        system_prompt=system,
        patient_id=patient_id,
    )


async def execute_weekly_digest(
    session: AsyncSession,
    event_id: int,
) -> ScheduleEvent:
    """Execute a weekly digest event.

    1. Load the event and patient.
    2. Skip if DORMANT.
    3. Gather data → build prompt → safety pipeline → persist.
    4. Auto-schedule next week's digest.
    """
    result = await session.execute(
        select(ScheduleEvent).where(ScheduleEvent.id == event_id)
    )
    event = result.scalar_one()

    # Load patient
    patient_result = await session.execute(
        select(Patient).where(Patient.id == event.patient_id)
    )
    patient = patient_result.scalar_one()

    # Skip if DORMANT
    if patient.phase == PatientPhase.DORMANT:
        event.status = ScheduleStatus.SKIPPED
        session.add(event)
        await session.commit()
        await session.refresh(event)
        return event

    # Gather data and build prompt
    data = await gather_weekly_data(session, patient.id)
    prompt = build_digest_prompt(data)

    # Generate through safety pipeline
    pipeline_result = await run_safety_pipeline(
        patient_id=patient.id,
        generate_fn=lambda augmented_prompt=False: _generate_digest_message(
            prompt,
            patient_id=patient.id,
            augmented_prompt=augmented_prompt,
        ),
    )

    # Update event
    event.message = pipeline_result.message
    event.status = ScheduleStatus.SENT
    event.executed_at = datetime.now(timezone.utc)
    session.add(event)
    await session.commit()
    await session.refresh(event)

    # Auto-schedule next week's digest
    next_digest = ScheduleEvent(
        patient_id=patient.id,
        event_type=EventType.WEEKLY_DIGEST,
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=7),
        status=ScheduleStatus.PENDING,
    )
    session.add(next_digest)
    await session.commit()

    return event


async def schedule_first_digest(
    session: AsyncSession,
    patient_id: int,
    *,
    goal_confirmed_at: datetime,
) -> ScheduleEvent:
    """Schedule the first weekly digest 7 days after goal confirmation."""
    event = ScheduleEvent(
        patient_id=patient_id,
        event_type=EventType.WEEKLY_DIGEST,
        scheduled_at=goal_confirmed_at + timedelta(days=7),
        status=ScheduleStatus.PENDING,
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event
