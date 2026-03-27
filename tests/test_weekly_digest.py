"""Tests for weekly progress digest service.

Covers:
- Data gathering: active patient, no goal, no program
- Prompt: contains goal, stats, streak, trend
- Generation: high/moderate/low adherence variants
- Execution: sets SENT status, stores message, skips dormant
- Scheduling: creates correct event type, 7-day offset, PENDING status
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventType, PatientPhase, ScheduleStatus
from app.models.goal import Goal
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent
from app.services.weekly_digest import (
    _generate_digest_message,
    build_digest_prompt,
    execute_weekly_digest,
    gather_weekly_data,
    schedule_first_digest,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_patient(
    session: AsyncSession,
    *,
    phase: PatientPhase = PatientPhase.ACTIVE,
    external_id: str = "PT-SARAH-001",
    program_type: str | None = "knee_rehab_post_surgical",
) -> Patient:
    patient = Patient(
        external_id=external_id,
        name="Test Patient",
        phase=phase,
        consent_given=True,
        program_type=program_type,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


async def _create_goal(
    session: AsyncSession,
    patient_id: int,
    *,
    raw_text: str = "Walk 30 minutes daily",
    confirmed: bool = True,
) -> Goal:
    goal = Goal(patient_id=patient_id, raw_text=raw_text, confirmed=confirmed)
    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    return goal


async def _create_digest_event(
    session: AsyncSession,
    patient_id: int,
) -> ScheduleEvent:
    event = ScheduleEvent(
        patient_id=patient_id,
        event_type=EventType.WEEKLY_DIGEST,
        scheduled_at=datetime.now(timezone.utc) - timedelta(hours=1),
        status=ScheduleStatus.PENDING,
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event


# ---------------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------------


class TestGatherWeeklyData:
    async def test_active_patient_with_goal(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        data = await gather_weekly_data(db_session, patient.id)
        assert data["goal_text"] == "Walk 30 minutes daily"
        assert data["phase"] == "ACTIVE"
        assert data["adherence_pct"] is not None

    async def test_patient_without_goal(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        data = await gather_weekly_data(db_session, patient.id)
        assert data["goal_text"] is None

    async def test_patient_without_program(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session, external_id="new-patient-123", program_type=None
        )
        data = await gather_weekly_data(db_session, patient.id)
        assert data["adherence_pct"] is None

    async def test_not_found_raises(self, db_session: AsyncSession):
        with pytest.raises(ValueError, match="not found"):
            await gather_weekly_data(db_session, 9999)


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------


class TestBuildDigestPrompt:
    def test_contains_goal(self):
        data = {
            "goal_text": "Walk 30 minutes daily",
            "adherence_pct": 75.0,
            "current_streak": 5,
            "days_completed": 15,
            "total_days": 21,
            "status": "MODERATE",
        }
        prompt = build_digest_prompt(data)
        assert "Walk 30 minutes daily" in prompt

    def test_contains_streak(self):
        data = {
            "goal_text": "Recovery",
            "adherence_pct": 80.0,
            "current_streak": 7,
            "days_completed": 18,
            "total_days": 21,
            "status": "HIGH",
        }
        prompt = build_digest_prompt(data)
        assert "7" in prompt

    def test_contains_adherence(self):
        data = {
            "goal_text": "Goal",
            "adherence_pct": 65.0,
            "current_streak": 3,
            "days_completed": 10,
            "total_days": 14,
            "status": "MODERATE",
        }
        prompt = build_digest_prompt(data)
        assert "65" in prompt

    def test_handles_no_adherence(self):
        data = {
            "goal_text": "Goal",
            "adherence_pct": None,
            "current_streak": 0,
            "days_completed": 0,
            "total_days": 0,
            "status": None,
        }
        prompt = build_digest_prompt(data)
        assert "No data" in prompt or "goal" in prompt.lower()

    def test_improving_trend(self):
        data = {
            "goal_text": "Goal",
            "adherence_pct": 85.0,
            "current_streak": 5,
            "days_completed": 18,
            "total_days": 21,
            "status": "HIGH",
        }
        prompt = build_digest_prompt(data)
        assert "improving" in prompt.lower()

    def test_declining_trend(self):
        data = {
            "goal_text": "Goal",
            "adherence_pct": 30.0,
            "current_streak": 0,
            "days_completed": 5,
            "total_days": 21,
            "status": "DECLINING",
        }
        prompt = build_digest_prompt(data)
        assert "declining" in prompt.lower()


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------


class TestExecuteWeeklyDigest:
    async def test_sets_sent_status(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        event = await _create_digest_event(db_session, patient.id)

        with patch(
            "app.services.weekly_digest.run_safety_pipeline",
        ) as mock_pipeline:
            from app.models.enums import SafetyStatus
            from app.services.safety_pipeline import SafetyPipelineResult

            mock_pipeline.return_value = SafetyPipelineResult(
                message="Your weekly progress!",
                safety_status=SafetyStatus.PASSED,
                attempts=1,
                crisis_alert_sent=False,
            )
            result = await execute_weekly_digest(db_session, event.id)

        assert result.status == ScheduleStatus.SENT

    async def test_stores_message(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        event = await _create_digest_event(db_session, patient.id)

        with patch(
            "app.services.weekly_digest.run_safety_pipeline",
        ) as mock_pipeline:
            from app.models.enums import SafetyStatus
            from app.services.safety_pipeline import SafetyPipelineResult

            mock_pipeline.return_value = SafetyPipelineResult(
                message="Great work this week!",
                safety_status=SafetyStatus.PASSED,
                attempts=1,
                crisis_alert_sent=False,
            )
            result = await execute_weekly_digest(db_session, event.id)

        assert result.message == "Great work this week!"

    async def test_skips_dormant_patient(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, phase=PatientPhase.DORMANT)
        event = await _create_digest_event(db_session, patient.id)

        result = await execute_weekly_digest(db_session, event.id)
        assert result.status == ScheduleStatus.SKIPPED
        assert result.message is None

    async def test_auto_schedules_next_digest(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        event = await _create_digest_event(db_session, patient.id)

        with patch(
            "app.services.weekly_digest.run_safety_pipeline",
        ) as mock_pipeline:
            from app.models.enums import SafetyStatus
            from app.services.safety_pipeline import SafetyPipelineResult

            mock_pipeline.return_value = SafetyPipelineResult(
                message="Progress!",
                safety_status=SafetyStatus.PASSED,
                attempts=1,
                crisis_alert_sent=False,
            )
            await execute_weekly_digest(db_session, event.id)

        # Check that a new WEEKLY_DIGEST event was created
        result = await db_session.execute(
            select(ScheduleEvent).where(
                ScheduleEvent.patient_id == patient.id,
                ScheduleEvent.event_type == EventType.WEEKLY_DIGEST,
                ScheduleEvent.status == ScheduleStatus.PENDING,
            )
        )
        next_events = result.scalars().all()
        assert len(next_events) == 1
        # Should be ~7 days from now
        delta = next_events[0].scheduled_at.replace(tzinfo=None) - datetime.now(timezone.utc).replace(tzinfo=None)
        assert 6 <= delta.days <= 7

    async def test_executed_at_set(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        await _create_goal(db_session, patient.id)
        event = await _create_digest_event(db_session, patient.id)

        with patch(
            "app.services.weekly_digest.run_safety_pipeline",
        ) as mock_pipeline:
            from app.models.enums import SafetyStatus
            from app.services.safety_pipeline import SafetyPipelineResult

            mock_pipeline.return_value = SafetyPipelineResult(
                message="Digest!",
                safety_status=SafetyStatus.PASSED,
                attempts=1,
                crisis_alert_sent=False,
            )
            result = await execute_weekly_digest(db_session, event.id)

        assert result.executed_at is not None


# ---------------------------------------------------------------------------
# Scheduling
# ---------------------------------------------------------------------------


class TestScheduleFirstDigest:
    async def test_creates_weekly_digest_event(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        now = datetime.now(timezone.utc)
        event = await schedule_first_digest(db_session, patient.id, goal_confirmed_at=now)

        assert event.event_type == EventType.WEEKLY_DIGEST
        assert event.status == ScheduleStatus.PENDING

    async def test_scheduled_7_days_after_goal(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        now = datetime.now(timezone.utc)
        event = await schedule_first_digest(db_session, patient.id, goal_confirmed_at=now)

        expected = (now + timedelta(days=7)).replace(tzinfo=None)
        actual = event.scheduled_at if event.scheduled_at.tzinfo is None else event.scheduled_at.replace(tzinfo=None)
        assert abs((actual - expected).total_seconds()) < 5

    async def test_persisted_to_db(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        now = datetime.now(timezone.utc)
        await schedule_first_digest(db_session, patient.id, goal_confirmed_at=now)

        result = await db_session.execute(
            select(ScheduleEvent).where(
                ScheduleEvent.patient_id == patient.id,
                ScheduleEvent.event_type == EventType.WEEKLY_DIGEST,
            )
        )
        events = result.scalars().all()
        assert len(events) == 1


# ---------------------------------------------------------------------------
# LLM integration: prompt and patient_id reach the LLM call
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@patch("app.services.weekly_digest.generate_llm_response", new_callable=AsyncMock)
async def test_digest_calls_llm_with_prompt(mock_llm, db_session):
    """Digest generation passes build_digest_prompt output to the LLM."""
    mock_llm.return_value = "This week you completed 5 of 7 exercise days! Your 3-day streak is building momentum."

    patient = await _create_patient(db_session)
    goal = await _create_goal(db_session, patient.id)
    event = await _create_digest_event(db_session, patient.id)

    result = await execute_weekly_digest(db_session, event.id)

    assert mock_llm.called
    call_kwargs = mock_llm.call_args.kwargs
    # The user message content should contain the digest prompt data
    user_content = call_kwargs["messages"][0]["content"]
    assert "goal" in user_content.lower() or "adherence" in user_content.lower()
    assert result.status == ScheduleStatus.SENT
    assert result.message == mock_llm.return_value


@pytest.mark.asyncio
@patch("app.services.weekly_digest.generate_llm_response", new_callable=AsyncMock)
async def test_digest_augmented_prompt_adds_retry_instruction(mock_llm, db_session):
    """When augmented_prompt=True, the system prompt includes the retry instruction."""
    mock_llm.return_value = "Keep up with your exercises this week!"

    result = await _generate_digest_message(
        "Patient data prompt here",
        patient_id=1,
        augmented_prompt=True,
    )

    call_kwargs = mock_llm.call_args.kwargs
    assert "Rephrase focusing only on exercise" in call_kwargs["system_prompt"]
