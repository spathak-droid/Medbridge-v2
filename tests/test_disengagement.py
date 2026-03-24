"""Tests for TICKET-012: disengagement handler with exponential backoff.

Covers all acceptance criteria:
- AC1: unanswered_count increments to 1, next outreach scheduled 2 days later
- AC2: unanswered_count at 1, increments to 2, next outreach scheduled 3 days later
- AC3: unanswered_count reaches 3 -> alert_clinician called, phase -> DORMANT
- AC4: DORMANT patient sends message -> unanswered_count resets, phase -> RE_ENGAGING
- AC5: Patient responds to check-in -> unanswered_count resets to 0
- AC6: DORMANT patient gets no further automated outreach
- Idempotency: record_unanswered twice for same message doesn't double-count
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.enums import (
    AlertUrgency,
    PatientPhase,
    ScheduleStatus,
)
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent
from app.services.disengagement import DisengagementHandler


def _strip_tz(dt: datetime) -> datetime:
    """Normalize datetime to naive for comparison (SQLite returns naive)."""
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


async def _create_active_patient(
    session: AsyncSession,
    *,
    external_id: str = "pat-dis-001",
    unanswered_count: int = 0,
    phase: PatientPhase = PatientPhase.ACTIVE,
) -> Patient:
    patient = Patient(
        external_id=external_id,
        name="Test Patient",
        phase=phase,
        consent_given=True,
        logged_in=True,
        unanswered_count=unanswered_count,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


class TestRecordUnansweredFirstMiss:
    """AC1: Coach sends message, patient doesn't respond within 1 day.
    unanswered_count -> 1, next outreach scheduled 1 day later."""

    async def test_increments_unanswered_count_to_1(self, db_session: AsyncSession):
        patient = await _create_active_patient(db_session)
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-001")

        await db_session.refresh(patient)
        assert patient.unanswered_count == 1

    async def test_schedules_next_outreach_1_day_later(self, db_session: AsyncSession):
        patient = await _create_active_patient(db_session)
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-001")

        result = await db_session.execute(
            select(ScheduleEvent).where(
                ScheduleEvent.patient_id == patient.id,
                ScheduleEvent.status == ScheduleStatus.PENDING,
            )
        )
        event = result.scalar_one()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expected_min = now + timedelta(hours=23)
        expected_max = now + timedelta(days=1, minutes=5)
        scheduled = _strip_tz(event.scheduled_at)
        assert expected_min <= scheduled <= expected_max

    async def test_patient_stays_active_after_first_miss(self, db_session: AsyncSession):
        patient = await _create_active_patient(db_session)
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-001")

        await db_session.refresh(patient)
        assert patient.phase == PatientPhase.ACTIVE


class TestRecordUnansweredSecondMiss:
    """AC2: unanswered_count is 1, patient still hasn't responded.
    unanswered_count -> 2, next outreach scheduled 2 days later."""

    async def test_increments_unanswered_count_to_2(self, db_session: AsyncSession):
        patient = await _create_active_patient(db_session, unanswered_count=1)
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-002")

        await db_session.refresh(patient)
        assert patient.unanswered_count == 2

    async def test_schedules_next_outreach_2_days_later(self, db_session: AsyncSession):
        patient = await _create_active_patient(db_session, unanswered_count=1)
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-002")

        result = await db_session.execute(
            select(ScheduleEvent).where(
                ScheduleEvent.patient_id == patient.id,
                ScheduleEvent.status == ScheduleStatus.PENDING,
            )
        )
        event = result.scalar_one()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expected_min = now + timedelta(days=1, hours=23)
        expected_max = now + timedelta(days=2, minutes=5)
        scheduled = _strip_tz(event.scheduled_at)
        assert expected_min <= scheduled <= expected_max


class TestRecordUnansweredThreshold:
    """AC3: unanswered_count reaches 3 -> alert_clinician called with
    reason 'patient_disengaged', phase -> DORMANT."""

    async def test_increments_to_3_and_transitions_to_dormant(
        self, db_session: AsyncSession,
    ):
        patient = await _create_active_patient(db_session, unanswered_count=2)
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-003")

        await db_session.refresh(patient)
        assert patient.unanswered_count == 3
        assert patient.phase == PatientPhase.DORMANT

    async def test_creates_clinician_alert(self, db_session: AsyncSession):
        patient = await _create_active_patient(
            db_session, external_id="pat-dis-alert", unanswered_count=2,
        )
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-003")

        result = await db_session.execute(
            select(Alert).where(Alert.patient_id == patient.id)
        )
        alert = result.scalar_one()
        assert alert.reason == "patient_disengaged"
        assert alert.urgency == AlertUrgency.HIGH

    async def test_no_outreach_scheduled_at_threshold(self, db_session: AsyncSession):
        patient = await _create_active_patient(
            db_session, external_id="pat-dis-nosch", unanswered_count=2,
        )
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-003")

        result = await db_session.execute(
            select(ScheduleEvent).where(
                ScheduleEvent.patient_id == patient.id,
                ScheduleEvent.status == ScheduleStatus.PENDING,
            )
        )
        events = result.scalars().all()
        assert len(events) == 0


class TestDormantPatientReturns:
    """AC4: DORMANT patient sends a message -> unanswered_count resets to 0,
    phase -> RE_ENGAGING."""

    async def test_resets_unanswered_count(self, db_session: AsyncSession):
        patient = await _create_active_patient(
            db_session, phase=PatientPhase.DORMANT, unanswered_count=3,
        )
        handler = DisengagementHandler(db_session)

        await handler.record_response(patient.id)

        await db_session.refresh(patient)
        assert patient.unanswered_count == 0

    async def test_transitions_to_re_engaging(self, db_session: AsyncSession):
        patient = await _create_active_patient(
            db_session,
            external_id="pat-dis-re",
            phase=PatientPhase.DORMANT,
            unanswered_count=3,
        )
        handler = DisengagementHandler(db_session)

        await handler.record_response(patient.id)

        await db_session.refresh(patient)
        assert patient.phase == PatientPhase.RE_ENGAGING


class TestPatientRespondsToCheckIn:
    """AC5: Patient responds to a check-in message -> unanswered_count resets to 0."""

    async def test_resets_unanswered_count_on_response(self, db_session: AsyncSession):
        patient = await _create_active_patient(db_session, unanswered_count=2)
        handler = DisengagementHandler(db_session)

        await handler.record_response(patient.id)

        await db_session.refresh(patient)
        assert patient.unanswered_count == 0

    async def test_active_patient_stays_active_on_response(self, db_session: AsyncSession):
        patient = await _create_active_patient(
            db_session, external_id="pat-dis-act", unanswered_count=1,
        )
        handler = DisengagementHandler(db_session)

        await handler.record_response(patient.id)

        await db_session.refresh(patient)
        assert patient.phase == PatientPhase.ACTIVE


class TestDormantNoOutreach:
    """AC6: DORMANT patient receives no further automated outreach."""

    async def test_record_unanswered_noop_for_dormant(self, db_session: AsyncSession):
        patient = await _create_active_patient(
            db_session, phase=PatientPhase.DORMANT, unanswered_count=3,
        )
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-dorm")

        await db_session.refresh(patient)
        assert patient.unanswered_count == 3  # unchanged
        result = await db_session.execute(
            select(ScheduleEvent).where(
                ScheduleEvent.patient_id == patient.id,
                ScheduleEvent.status == ScheduleStatus.PENDING,
            )
        )
        events = result.scalars().all()
        assert len(events) == 0


class TestIdempotency:
    """Calling record_unanswered twice for the same missed message
    shouldn't double-count."""

    async def test_duplicate_message_id_not_double_counted(self, db_session: AsyncSession):
        patient = await _create_active_patient(
            db_session, external_id="pat-dis-idem",
        )
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-dup")
        await handler.record_unanswered(patient.id, message_id="msg-dup")

        await db_session.refresh(patient)
        assert patient.unanswered_count == 1

    async def test_different_message_ids_both_counted(self, db_session: AsyncSession):
        patient = await _create_active_patient(
            db_session, external_id="pat-dis-diff",
        )
        handler = DisengagementHandler(db_session)

        await handler.record_unanswered(patient.id, message_id="msg-a")
        await handler.record_unanswered(patient.id, message_id="msg-b")

        await db_session.refresh(patient)
        assert patient.unanswered_count == 2
