"""Background scheduler for follow-up check-ins and disengagement detection.

Runs as an asyncio background task within the FastAPI application lifecycle.
Periodically:
1. Executes due scheduled events (Day 2, 5, 7 check-ins + backoff reminders)
2. Detects unanswered coach messages and triggers disengagement tracking
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import async_session_factory
from app.models.conversation import Conversation
from app.models.enums import EventType, MessageRole, PatientPhase, SafetyStatus, ScheduleStatus
from app.models.message import Message
from app.models.patient import Patient
from app.services.disengagement import DisengagementHandler
from app.services.email_service import (
    build_checkin_email,
    build_digest_email,
    build_reminder_email,
    send_email,
)
from app.services.followup_service import execute_checkin, get_due_events
from app.services.weekly_digest import execute_weekly_digest

logger = logging.getLogger(__name__)

# How often the scheduler runs (seconds)
SCHEDULER_INTERVAL = 60

# How long after a coach message before it's considered "unanswered"
UNANSWERED_THRESHOLD = timedelta(hours=24)


async def _execute_due_events() -> int:
    """Find and execute all due scheduled events. Returns count executed."""
    executed = 0
    async with async_session_factory() as session:
        events = await get_due_events(session)
        for event in events:
            try:
                # Dispatch WEEKLY_DIGEST events to the digest service
                if event.event_type == EventType.WEEKLY_DIGEST:
                    result = await execute_weekly_digest(session, event.id)
                else:
                    result = await execute_checkin(session, event.id)
                if result.status == ScheduleStatus.SENT and result.message:
                    # Persist the check-in as a coach message in the conversation
                    await _persist_checkin_message(session, event.patient_id, result.message)
                    # Send email notification
                    await _send_event_email(session, event.patient_id, event.event_type, result.message)
                executed += 1
            except Exception:
                logger.exception("Failed to execute event %s", event.id)
    return executed


async def _persist_checkin_message(session, patient_id: int, content: str) -> None:
    """Create a coach Message in the patient's latest conversation for a check-in."""
    conv_result = await session.execute(
        select(Conversation)
        .where(Conversation.patient_id == patient_id)
        .order_by(Conversation.started_at.desc())
    )
    conversation = conv_result.scalar_one_or_none()
    if conversation is None:
        return

    msg = Message(
        conversation_id=conversation.id,
        role=MessageRole.COACH,
        content=content,
        safety_status=SafetyStatus.PASSED,
        created_at=datetime.now(timezone.utc),
    )
    session.add(msg)
    await session.commit()


async def _send_event_email(session, patient_id: int, event_type: EventType, message: str) -> None:
    """Send an email notification for a scheduled event if the patient has an email."""
    try:
        patient_result = await session.execute(
            select(Patient).where(Patient.id == patient_id)
        )
        patient = patient_result.scalar_one_or_none()
        if not patient or not patient.email:
            return

        if event_type == EventType.WEEKLY_DIGEST:
            email_data = build_digest_email(patient.name, message)
        elif event_type == EventType.REMINDER:
            email_data = build_reminder_email(patient.name, message)
        else:
            day_label = event_type.value.replace("_", " ")
            email_data = build_checkin_email(patient.name, message, day_label)

        await send_email(to=patient.email, **email_data)
    except Exception:
        logger.exception("Failed to send email for event to patient %s", patient_id)


async def _check_unanswered_messages() -> int:
    """Detect patients with unanswered coach messages and track disengagement.

    Finds patients in ACTIVE/RE_ENGAGING phase where the last message in their
    conversation is from the COACH and was sent more than UNANSWERED_THRESHOLD ago.
    """
    detected = 0
    cutoff_aware = datetime.now(timezone.utc) - UNANSWERED_THRESHOLD
    cutoff_naive = cutoff_aware.replace(tzinfo=None)

    async with async_session_factory() as session:
        # Find active patients
        patient_result = await session.execute(
            select(Patient).where(
                Patient.phase.in_([PatientPhase.ONBOARDING, PatientPhase.ACTIVE, PatientPhase.RE_ENGAGING])
            )
        )
        patients = patient_result.scalars().all()

        for patient in patients:
            try:
                # Get latest conversation
                conv_result = await session.execute(
                    select(Conversation)
                    .where(Conversation.patient_id == patient.id)
                    .order_by(Conversation.started_at.desc())
                    .limit(1)
                )
                conversation = conv_result.scalar_one_or_none()
                if conversation is None:
                    continue

                # Get the last message
                msg_result = await session.execute(
                    select(Message)
                    .where(Message.conversation_id == conversation.id)
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
                last_msg = msg_result.scalar_one_or_none()
                if last_msg is None:
                    continue

                # If last message is from coach and older than threshold
                msg_time = last_msg.created_at
                cutoff = cutoff_aware if msg_time.tzinfo else cutoff_naive
                if (
                    last_msg.role == MessageRole.COACH
                    and msg_time < cutoff
                ):
                    handler = DisengagementHandler(session)
                    await handler.record_unanswered(
                        patient.id, message_id=str(last_msg.id)
                    )
                    detected += 1
            except Exception:
                logger.exception(
                    "Disengagement check failed for patient %s", patient.id
                )

    return detected


async def run_scheduler() -> None:
    """Main scheduler loop. Runs until cancelled."""
    logger.info("Scheduler started (interval=%ds)", SCHEDULER_INTERVAL)
    while True:
        try:
            executed = await _execute_due_events()
            if executed:
                logger.info("Scheduler: executed %d due events", executed)

            detected = await _check_unanswered_messages()
            if detected:
                logger.info("Scheduler: detected %d unanswered messages", detected)
        except Exception:
            logger.exception("Scheduler tick failed")

        await asyncio.sleep(SCHEDULER_INTERVAL)
