"""Disengagement handler with exponential backoff — TICKET-012.

Tracks unanswered messages and implements exponential backoff:
  1 day → 2 days → 3 days → DORMANT

After 3 unanswered messages, a clinician alert is sent and the patient
transitions to DORMANT. When a dormant patient returns, they enter RE_ENGAGING.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.enums import AlertUrgency, EventType, PatientPhase, ScheduleStatus
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent
from app.services.phase_machine import PhaseStateMachine

# Backoff schedule: index is unanswered_count (after increment), value is days until next outreach.
# At index 3 (threshold), patient goes dormant — no further outreach.
BACKOFF_SCHEDULE = [1, 2, 3]
DORMANT_THRESHOLD = len(BACKOFF_SCHEDULE)


class DisengagementHandler:
    """Manages patient disengagement tracking and exponential backoff.

    Usage:
        handler = DisengagementHandler(session)
        await handler.record_unanswered(patient_id, message_id="msg-123")
        await handler.record_response(patient_id)
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._phase_machine = PhaseStateMachine(session)

    async def record_unanswered(self, patient_id: int, *, message_id: str) -> None:
        """Record that a coach message went unanswered.

        Increments unanswered_count, schedules next outreach with backoff,
        and transitions to DORMANT at threshold (3).

        Idempotent: calling twice with the same message_id is a no-op.
        """
        patient = await self._get_patient(patient_id)

        # No-op for DORMANT patients — AC6
        if patient.phase == PatientPhase.DORMANT:
            return

        # Idempotency check
        if patient.last_unanswered_message_id == message_id:
            return

        patient.unanswered_count += 1
        patient.last_unanswered_message_id = message_id
        self._session.add(patient)
        await self._session.commit()
        await self._session.refresh(patient)

        if patient.unanswered_count >= DORMANT_THRESHOLD:
            # Create clinician alert
            alert = Alert(
                patient_id=patient_id,
                reason="patient_disengaged",
                urgency=AlertUrgency.HIGH,
            )
            self._session.add(alert)
            await self._session.commit()

            # Transition to DORMANT
            await self._phase_machine.transition(patient_id, PatientPhase.DORMANT)
        else:
            # Schedule next outreach with backoff
            backoff_days = BACKOFF_SCHEDULE[patient.unanswered_count - 1]
            scheduled_at = datetime.now(timezone.utc) + timedelta(days=backoff_days)
            event = ScheduleEvent(
                patient_id=patient_id,
                event_type=EventType.REMINDER,
                scheduled_at=scheduled_at,
                message="Scheduled follow-up (backoff)",
                status=ScheduleStatus.PENDING,
            )
            self._session.add(event)
            await self._session.commit()

    async def record_response(self, patient_id: int) -> None:
        """Record that a patient responded.

        Resets unanswered_count to 0. If patient is DORMANT, transitions
        to RE_ENGAGING.
        """
        patient = await self._get_patient(patient_id)
        was_dormant = patient.phase == PatientPhase.DORMANT

        patient.unanswered_count = 0
        patient.last_unanswered_message_id = None
        self._session.add(patient)
        await self._session.commit()

        if was_dormant:
            await self._phase_machine.transition(patient_id, PatientPhase.RE_ENGAGING)

    async def _get_patient(self, patient_id: int) -> Patient:
        result = await self._session.execute(
            select(Patient).where(Patient.id == patient_id)
        )
        patient = result.scalar_one_or_none()
        if patient is None:
            raise ValueError(f"Patient {patient_id} not found")
        return patient
