"""Tests for TICKET-011: scheduled follow-up service for Day 2, 5, and 7 check-ins.

Covers all acceptance criteria:
- Goal confirmed → follow-ups scheduled for Day 2, 5, and 7
- Day 2 check-in sends message referencing patient's goal
- Good adherence → celebratory tone
- Low adherence → gentle nudge tone
- Unknown/no adherence → neutral check-in tone
- Generated messages pass through safety pipeline
- DORMANT patient → check-in skipped (status=SKIPPED)
- Executed check-in → ScheduleEvent updated with executed_at and status=SENT
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    EventType,
    PatientPhase,
    ScheduleStatus,
)
from app.models.goal import Goal
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent
from app.services.followup_service import (
    determine_tone,
    execute_checkin,
    schedule_followups,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_patient(
    session: AsyncSession,
    *,
    phase: PatientPhase = PatientPhase.ACTIVE,
    name: str = "Test Patient",
) -> Patient:
    patient = Patient(
        external_id="ext-1",
        name=name,
        phase=phase,
        consent_given=True,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


async def _create_goal(
    session: AsyncSession,
    patient_id: int,
    *,
    confirmed: bool = True,
    raw_text: str = "Walk 30 minutes daily",
) -> Goal:
    goal = Goal(
        patient_id=patient_id,
        raw_text=raw_text,
        confirmed=confirmed,
    )
    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    return goal


# ---------------------------------------------------------------------------
# AC1: Goal confirmed → follow-ups scheduled for Day 2, 5, and 7
# ---------------------------------------------------------------------------


class TestScheduleFollowups:
    async def test_creates_three_events(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        now = datetime.now(timezone.utc)

        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)

        assert len(events) == 3

    async def test_event_types_are_day_2_5_7(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        now = datetime.now(timezone.utc)

        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)

        event_types = {e.event_type for e in events}
        assert event_types == {EventType.DAY_2, EventType.DAY_5, EventType.DAY_7}

    async def test_scheduled_times_relative_to_onboarding(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        now = datetime.now(timezone.utc)

        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)

        events_by_type = {e.event_type: e for e in events}
        # SQLite drops tzinfo, so compare naive datetimes
        now_naive = now.replace(tzinfo=None)
        assert events_by_type[EventType.DAY_2].scheduled_at == now_naive + timedelta(days=2)
        assert events_by_type[EventType.DAY_5].scheduled_at == now_naive + timedelta(days=5)
        assert events_by_type[EventType.DAY_7].scheduled_at == now_naive + timedelta(days=7)

    async def test_events_persisted_to_db(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        now = datetime.now(timezone.utc)

        await schedule_followups(db_session, patient.id, onboarding_completed_at=now)

        result = await db_session.execute(
            select(ScheduleEvent).where(ScheduleEvent.patient_id == patient.id)
        )
        db_events = result.scalars().all()
        assert len(db_events) == 4  # 3 followups + 1 weekly digest

    async def test_events_have_pending_status(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        now = datetime.now(timezone.utc)

        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)

        for event in events:
            assert event.status == ScheduleStatus.PENDING


# ---------------------------------------------------------------------------
# AC2-5: Tone selection based on adherence
# ---------------------------------------------------------------------------


class TestDetermineTone:
    def test_high_adherence_celebration(self):
        assert determine_tone(80.0) == "celebration"

    def test_very_high_adherence_celebration(self):
        assert determine_tone(100.0) == "celebration"

    def test_exactly_80_is_celebration(self):
        assert determine_tone(80.0) == "celebration"

    def test_low_adherence_nudge(self):
        assert determine_tone(30.0) == "nudge"

    def test_very_low_adherence_nudge(self):
        assert determine_tone(0.0) == "nudge"

    def test_below_40_is_nudge(self):
        assert determine_tone(39.9) == "nudge"

    def test_middle_adherence_checkin(self):
        assert determine_tone(50.0) == "check-in"

    def test_exactly_40_is_checkin(self):
        assert determine_tone(40.0) == "check-in"

    def test_79_is_checkin(self):
        assert determine_tone(79.9) == "check-in"

    def test_none_adherence_checkin(self):
        assert determine_tone(None) == "check-in"


# ---------------------------------------------------------------------------
# AC2: Day 2 check-in references the patient's goal
# ---------------------------------------------------------------------------


class TestExecuteCheckin:
    async def test_message_references_goal(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id, raw_text="Walk 30 minutes daily")
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        with patch(
            "app.services.followup_service._get_adherence_percentage",
            new_callable=AsyncMock,
            return_value=50.0,
        ), patch(
            "app.services.followup_service._generate_checkin_message",
            new_callable=AsyncMock,
            return_value="How's your goal of Walk 30 minutes daily going?",
        ) as mock_gen:
            await execute_checkin(db_session, day2_event.id)

            # Verify generate was called with goal text
            call_kwargs = mock_gen.call_args[1]
            assert "Walk 30 minutes daily" in call_kwargs["goal_text"]

    async def test_executed_event_has_sent_status(self, db_session: AsyncSession):
        """AC8: ScheduleEvent updated with status SENT."""
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        with patch(
            "app.services.followup_service._get_adherence_percentage",
            new_callable=AsyncMock,
            return_value=50.0,
        ), patch(
            "app.services.followup_service._generate_checkin_message",
            new_callable=AsyncMock,
            return_value="Keep going!",
        ):
            result = await execute_checkin(db_session, day2_event.id)

        assert result.status == ScheduleStatus.SENT

    async def test_executed_event_has_executed_at(self, db_session: AsyncSession):
        """AC8: ScheduleEvent updated with executed_at timestamp."""
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        with patch(
            "app.services.followup_service._get_adherence_percentage",
            new_callable=AsyncMock,
            return_value=50.0,
        ), patch(
            "app.services.followup_service._generate_checkin_message",
            new_callable=AsyncMock,
            return_value="Keep going!",
        ):
            result = await execute_checkin(db_session, day2_event.id)

        assert result.executed_at is not None

    async def test_executed_event_has_message(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        with patch(
            "app.services.followup_service._get_adherence_percentage",
            new_callable=AsyncMock,
            return_value=50.0,
        ), patch(
            "app.services.followup_service._generate_checkin_message",
            new_callable=AsyncMock,
            return_value="Keep going with your exercises!",
        ):
            result = await execute_checkin(db_session, day2_event.id)

        assert result.message == "Keep going with your exercises!"


# ---------------------------------------------------------------------------
# AC3: Good adherence → celebratory tone
# ---------------------------------------------------------------------------


class TestCelebratoryTone:
    async def test_high_adherence_uses_celebration_tone(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        with patch(
            "app.services.followup_service._get_adherence_percentage",
            new_callable=AsyncMock,
            return_value=90.0,
        ), patch(
            "app.services.followup_service._generate_checkin_message",
            new_callable=AsyncMock,
            return_value="Amazing work!",
        ) as mock_gen:
            await execute_checkin(db_session, day2_event.id)

            call_kwargs = mock_gen.call_args[1]
            assert call_kwargs["tone"] == "celebration"


# ---------------------------------------------------------------------------
# AC4: Low adherence → nudge tone
# ---------------------------------------------------------------------------


class TestNudgeTone:
    async def test_low_adherence_uses_nudge_tone(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        with patch(
            "app.services.followup_service._get_adherence_percentage",
            new_callable=AsyncMock,
            return_value=20.0,
        ), patch(
            "app.services.followup_service._generate_checkin_message",
            new_callable=AsyncMock,
            return_value="Let's get back on track!",
        ) as mock_gen:
            await execute_checkin(db_session, day2_event.id)

            call_kwargs = mock_gen.call_args[1]
            assert call_kwargs["tone"] == "nudge"


# ---------------------------------------------------------------------------
# AC5: Unknown adherence → neutral check-in tone
# ---------------------------------------------------------------------------


class TestNeutralTone:
    async def test_none_adherence_uses_checkin_tone(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        with patch(
            "app.services.followup_service._get_adherence_percentage",
            new_callable=AsyncMock,
            return_value=None,
        ), patch(
            "app.services.followup_service._generate_checkin_message",
            new_callable=AsyncMock,
            return_value="How are things going?",
        ) as mock_gen:
            await execute_checkin(db_session, day2_event.id)

            call_kwargs = mock_gen.call_args[1]
            assert call_kwargs["tone"] == "check-in"


# ---------------------------------------------------------------------------
# AC6: Messages pass through safety pipeline
# ---------------------------------------------------------------------------


class TestSafetyPipelineIntegration:
    async def test_message_passes_through_safety_pipeline(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        with patch(
            "app.services.followup_service._get_adherence_percentage",
            new_callable=AsyncMock,
            return_value=50.0,
        ), patch(
            "app.services.followup_service.run_safety_pipeline",
        ) as mock_pipeline:
            from app.models.enums import SafetyStatus
            from app.services.safety_pipeline import SafetyPipelineResult

            mock_pipeline.return_value = SafetyPipelineResult(
                message="Safe check-in message",
                safety_status=SafetyStatus.PASSED,
                attempts=1,
                crisis_alert_sent=False,
            )
            result = await execute_checkin(db_session, day2_event.id)

            mock_pipeline.assert_called_once()
            assert result.message == "Safe check-in message"


# ---------------------------------------------------------------------------
# AC7: DORMANT patient → check-in skipped
# ---------------------------------------------------------------------------


class TestDormantSkip:
    async def test_dormant_patient_skips_checkin(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, phase=PatientPhase.DORMANT)
        await _create_goal(db_session, patient.id)
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        result = await execute_checkin(db_session, day2_event.id)

        assert result.status == ScheduleStatus.SKIPPED

    async def test_dormant_patient_no_message_generated(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, phase=PatientPhase.DORMANT)
        await _create_goal(db_session, patient.id)
        now = datetime.now(timezone.utc)
        events = await schedule_followups(db_session, patient.id, onboarding_completed_at=now)
        day2_event = next(e for e in events if e.event_type == EventType.DAY_2)

        result = await execute_checkin(db_session, day2_event.id)

        assert result.message is None


# ---------------------------------------------------------------------------
# Process due events
# ---------------------------------------------------------------------------


class TestProcessDueEvents:
    async def test_processes_only_pending_due_events(self, db_session: AsyncSession):
        from app.services.followup_service import get_due_events

        patient = await _create_patient(db_session)
        now = datetime.now(timezone.utc)
        past = now - timedelta(hours=1)
        future = now + timedelta(days=10)

        # One due event
        due_event = ScheduleEvent(
            patient_id=patient.id,
            event_type=EventType.DAY_2,
            scheduled_at=past,
            status=ScheduleStatus.PENDING,
        )
        # One future event
        future_event = ScheduleEvent(
            patient_id=patient.id,
            event_type=EventType.DAY_5,
            scheduled_at=future,
            status=ScheduleStatus.PENDING,
        )
        # One already sent
        sent_event = ScheduleEvent(
            patient_id=patient.id,
            event_type=EventType.DAY_7,
            scheduled_at=past,
            status=ScheduleStatus.SENT,
        )
        session = db_session
        session.add_all([due_event, future_event, sent_event])
        await session.commit()

        due = await get_due_events(session)
        assert len(due) == 1
        assert due[0].event_type == EventType.DAY_2
