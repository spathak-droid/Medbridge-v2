"""Scheduled follow-up service — TICKET-011.

Creates and executes time-based follow-up check-ins at Day 2, 5, and 7
after onboarding completion. Each check-in references the patient's stored
goal and adjusts tone based on adherence data.

Tone selection (pure function):
- adherence_pct >= 80% → celebration
- adherence_pct < 40%  → nudge
- otherwise (or None)  → check-in
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventType, PatientPhase, ScheduleStatus
from app.models.goal import Goal
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent
from app.services.llm_provider import generate_llm_response
from app.services.nudge_engine import build_nudge_prompt, select_nudge_type
from app.services.safety_pipeline import run_safety_pipeline

# ---------------------------------------------------------------------------
# Day offsets for each event type
# ---------------------------------------------------------------------------

DAY_OFFSETS: list[tuple[EventType, int]] = [
    (EventType.DAY_2, 2),
    (EventType.DAY_5, 5),
    (EventType.DAY_7, 7),
]

# ---------------------------------------------------------------------------
# Tone-specific prompt templates
# ---------------------------------------------------------------------------

TONE_PROMPTS: dict[str, str] = {
    "celebration": (
        "The patient has been doing great with their exercises! "
        "Write a short, warm, celebratory check-in message referencing their goal: '{goal}'. "
        "Be encouraging and specific about their progress."
    ),
    "nudge": (
        "The patient has been struggling with exercise adherence. "
        "Write a short, gentle, supportive nudge referencing their goal: '{goal}'. "
        "Be empathetic and motivating without being judgmental."
    ),
    "check-in": (
        "Write a short, neutral check-in message for the patient referencing their goal: '{goal}'. "
        "Ask how things are going and offer support."
    ),
}


CHECKIN_SYSTEM_PROMPT = (
    "You are a supportive rehabilitation coach writing a scheduled check-in message. "
    "Keep it to 2-3 sentences. Be warm, specific, and motivating. "
    "Never provide medical advice, diagnoses, or medication recommendations. "
    "Focus only on exercise motivation and emotional support."
)


def determine_tone(adherence_pct: float | None) -> str:
    """Determine check-in tone based on adherence percentage.

    Pure function:
    - >= 80% → "celebration"
    - < 40%  → "nudge"
    - 40-79% or None → "check-in"
    """
    if adherence_pct is None:
        return "check-in"
    if adherence_pct >= 80.0:
        return "celebration"
    if adherence_pct < 40.0:
        return "nudge"
    return "check-in"


async def schedule_followups(
    session: AsyncSession,
    patient_id: int,
    *,
    onboarding_completed_at: datetime,
) -> list[ScheduleEvent]:
    """Schedule Day 2, 5, and 7 follow-up events for a patient.

    Creates three ScheduleEvent records relative to the onboarding
    completion timestamp.
    """
    events: list[ScheduleEvent] = []
    for event_type, day_offset in DAY_OFFSETS:
        event = ScheduleEvent(
            patient_id=patient_id,
            event_type=event_type,
            scheduled_at=onboarding_completed_at + timedelta(days=day_offset),
            status=ScheduleStatus.PENDING,
        )
        session.add(event)
        events.append(event)

    # Also schedule first weekly digest at day 7
    digest_event = ScheduleEvent(
        patient_id=patient_id,
        event_type=EventType.WEEKLY_DIGEST,
        scheduled_at=onboarding_completed_at + timedelta(days=7),
        status=ScheduleStatus.PENDING,
    )
    session.add(digest_event)

    await session.commit()
    for event in events:
        await session.refresh(event)
    return events


async def get_due_events(session: AsyncSession) -> list[ScheduleEvent]:
    """Return all PENDING events whose scheduled_at is in the past."""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(ScheduleEvent).where(
            ScheduleEvent.status == ScheduleStatus.PENDING,
            ScheduleEvent.scheduled_at <= now,
        )
    )
    return list(result.scalars().all())


async def _get_adherence_percentage(session: AsyncSession, patient_id: int) -> float | None:
    """Get adherence percentage for a patient.

    Calls the stubbed get_adherence_summary tool and extracts the percentage.
    Returns None if data is unavailable.
    """
    from app.tools.coach_tools import make_coach_tools

    tools = make_coach_tools(session, patient_id)
    adherence_tool = next(t for t in tools if t.name == "get_adherence_summary")
    raw = await adherence_tool.ainvoke({})
    data = json.loads(raw)
    pct = data.get("adherence_percentage")
    return float(pct) if pct is not None else None


async def _generate_checkin_message(
    *,
    goal_text: str,
    tone: str,
    event_type: EventType,
    nudge_prompt: str = "",
    patient_id: int,
    augmented_prompt: bool = False,
) -> str:
    """Generate a check-in message via LLM with tone and nudge framing."""
    day_label = event_type.value.replace("_", " ")
    tone_instruction = TONE_PROMPTS.get(tone, TONE_PROMPTS["check-in"]).format(goal=goal_text)

    system_parts = [CHECKIN_SYSTEM_PROMPT, f"\nThis is a {day_label} check-in.", tone_instruction]
    if nudge_prompt:
        system_parts.append(f"\nBehavioral framing:\n{nudge_prompt}")
    if augmented_prompt:
        from app.services.safety_pipeline import AUGMENTED_RETRY_INSTRUCTION
        system_parts.append(f"\n{AUGMENTED_RETRY_INSTRUCTION}")

    system_prompt = "\n".join(system_parts)

    return await generate_llm_response(
        messages=[{"role": "user", "content": f"Write a check-in message for my goal: {goal_text}"}],
        system_prompt=system_prompt,
        patient_id=patient_id,
    )


async def execute_checkin(
    session: AsyncSession,
    event_id: int,
) -> ScheduleEvent:
    """Execute a single scheduled check-in.

    1. Load the ScheduleEvent and associated patient.
    2. If patient is DORMANT, mark event as SKIPPED.
    3. Get adherence data → determine tone.
    4. Generate message → run through safety pipeline.
    5. Update event with message, executed_at, and status=SENT.
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

    # Get patient's goal
    goal_result = await session.execute(
        select(Goal).where(
            Goal.patient_id == patient.id,
            Goal.confirmed == True,  # noqa: E712
        )
    )
    goal = goal_result.scalar_one_or_none()
    goal_text = goal.raw_text if goal else "your rehabilitation exercises"

    # Get adherence and determine tone
    adherence_pct = await _get_adherence_percentage(session, patient.id)
    tone = determine_tone(adherence_pct)

    # Use nudge engine for behaviorally-informed message generation
    from app.data.adherence import get_adherence_for_patient

    adh = get_adherence_for_patient(patient.external_id, patient.program_type)
    streak = adh.get("current_streak", 0) if adh else 0
    trend = adh.get("status") if adh else None
    pct = adherence_pct if adherence_pct is not None else 0.0

    nudge_type = select_nudge_type(
        streak=streak,
        adherence_pct=pct,
        trend=trend,
        phase=patient.phase.value,
    )
    nudge_prompt = build_nudge_prompt(
        nudge_type,
        goal=goal_text,
        streak=streak,
        adherence_pct=pct,
    )

    # Generate message through safety pipeline
    pipeline_result = await run_safety_pipeline(
        patient_id=patient.id,
        generate_fn=lambda augmented_prompt=False: _generate_checkin_message(
            goal_text=goal_text,
            tone=tone,
            event_type=event.event_type,
            nudge_prompt=nudge_prompt,
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
    return event
