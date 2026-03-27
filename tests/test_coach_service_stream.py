"""Tests for streaming coach turn safety parity.

Covers:
- PENDING phase yields error event
- DORMANT phase yields error event
- SAFE classification yields done event
- CLINICAL_CONTENT triggers non-streaming retry
- Successful retry yields safety_override with safe content
- Failed retry yields safety_override with fallback
- CRISIS yields safety_override with crisis message
"""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PatientPhase, SafetyClassification, SafetyStatus
from app.services.coach_service import run_coach_turn_stream


async def _collect_events(gen) -> list[dict]:
    """Collect all SSE events from the stream generator."""
    events = []
    async for event_str in gen:
        for line in event_str.strip().split("\n"):
            if line.startswith("event: "):
                event_type = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
                events.append({"type": event_type, "data": data})
    return events


@pytest.mark.asyncio
@patch("app.services.coach_service._get_patient")
@patch("app.services.coach_service._get_confirmed_goal", new_callable=AsyncMock)
async def test_pending_patient_yields_error(mock_get_goal, mock_get_patient, db_session):
    """PENDING patients get an error event, not a prompt fallthrough."""
    patient = MagicMock()
    patient.phase = PatientPhase.PENDING
    mock_get_patient.return_value = patient
    mock_get_goal.return_value = None

    events = await _collect_events(
        run_coach_turn_stream(db_session, 1, 1, "hello")
    )
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "onboarding" in events[0]["data"]["detail"].lower()


@pytest.mark.asyncio
@patch("app.services.coach_service._get_patient")
@patch("app.services.coach_service._get_confirmed_goal", new_callable=AsyncMock)
async def test_dormant_patient_yields_error(mock_get_goal, mock_get_patient, db_session):
    """DORMANT patients get an error event."""
    patient = MagicMock()
    patient.phase = PatientPhase.DORMANT
    mock_get_patient.return_value = patient
    mock_get_goal.return_value = None

    events = await _collect_events(
        run_coach_turn_stream(db_session, 1, 1, "hello")
    )
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "dormant" in events[0]["data"]["detail"].lower()


@pytest.mark.asyncio
@patch("app.services.coach_service._get_conversation_messages", new_callable=AsyncMock)
@patch("app.services.coach_service.make_coach_tools")
@patch("app.services.coach_service._get_patient")
@patch("app.services.coach_service._get_confirmed_goal", new_callable=AsyncMock)
@patch("app.services.coach_service._build_system_prompt_for_phase")
@patch("app.services.coach_service.generate_llm_response_stream")
@patch("app.services.coach_service.SafetyClassifierService")
@patch("app.services.coach_service._find_latest_unconfirmed_goal", new_callable=AsyncMock)
async def test_safe_response_yields_done_event(
    mock_find_goal,
    mock_classifier_cls,
    mock_stream,
    mock_build_prompt,
    mock_get_goal,
    mock_get_patient,
    mock_tools,
    mock_msgs,
    db_session,
):
    """A SAFE classification produces token events followed by a done event."""
    patient = MagicMock()
    patient.phase = PatientPhase.ACTIVE
    patient.id = 1
    mock_get_patient.return_value = patient
    mock_get_goal.return_value = "Walk daily"
    mock_msgs.return_value = []
    mock_tools.return_value = []
    mock_build_prompt.return_value = "You are a helpful coach."
    mock_find_goal.return_value = None

    async def fake_stream(**kwargs):
        yield "Keep up with your exercises!"

    mock_stream.return_value = fake_stream()

    classifier_instance = MagicMock()
    classifier_instance.classify = AsyncMock(return_value=MagicMock(
        classification=SafetyClassification.SAFE,
        matched_patterns=[],
    ))
    mock_classifier_cls.return_value = classifier_instance

    events = await _collect_events(
        run_coach_turn_stream(db_session, 1, 1, "how am I doing?")
    )

    token_events = [e for e in events if e["type"] == "token"]
    done_events = [e for e in events if e["type"] == "done"]
    assert len(token_events) >= 1
    assert len(done_events) == 1
    assert "Keep up with your exercises!" in done_events[0]["data"]["content"]


@pytest.mark.asyncio
@patch("app.services.coach_service.generate_llm_response", new_callable=AsyncMock)
@patch("app.services.coach_service.SafetyClassifierService")
@patch("app.services.coach_service.generate_llm_response_stream")
@patch("app.services.coach_service._get_confirmed_goal", new_callable=AsyncMock)
@patch("app.services.coach_service._get_patient")
@patch("app.services.coach_service.make_coach_tools")
@patch("app.services.coach_service._get_conversation_messages", new_callable=AsyncMock)
@patch("app.services.coach_service._build_system_prompt_for_phase")
@patch("app.services.coach_service._find_latest_unconfirmed_goal", new_callable=AsyncMock)
async def test_clinical_content_triggers_retry(
    mock_find_goal,
    mock_build_prompt,
    mock_msgs,
    mock_tools,
    mock_get_patient,
    mock_get_goal,
    mock_stream,
    mock_classifier_cls,
    mock_llm,
    db_session,
):
    """CLINICAL_CONTENT classification triggers a non-streaming retry."""
    patient = MagicMock()
    patient.phase = PatientPhase.ACTIVE
    patient.id = 1
    mock_get_patient.return_value = patient
    mock_get_goal.return_value = "Walk daily"
    mock_msgs.return_value = []
    mock_tools.return_value = []
    mock_build_prompt.return_value = "You are a helpful coach."
    mock_find_goal.return_value = None

    # Stream returns clinical content
    async def fake_stream(**kwargs):
        yield "You should take ibuprofen"

    mock_stream.return_value = fake_stream()

    # Classifier: first call returns CLINICAL, second returns SAFE
    classifier_instance = MagicMock()
    classifier_instance.classify = AsyncMock(side_effect=[
        MagicMock(
            classification=SafetyClassification.CLINICAL_CONTENT,
            matched_patterns=["ibuprofen"],
        ),
        MagicMock(
            classification=SafetyClassification.SAFE,
            matched_patterns=[],
        ),
    ])
    mock_classifier_cls.return_value = classifier_instance

    # Retry LLM call returns safe content
    mock_llm.return_value = "Keep up with your exercises!"

    events = await _collect_events(
        run_coach_turn_stream(db_session, 1, 1, "how should I manage pain?")
    )

    # Should have token events + safety_override
    override_events = [e for e in events if e["type"] == "safety_override"]
    assert len(override_events) == 1
    assert override_events[0]["data"]["content"] == "Keep up with your exercises!"
    assert mock_llm.called  # retry was attempted


@pytest.mark.asyncio
@patch("app.services.coach_service.generate_llm_response", new_callable=AsyncMock)
@patch("app.services.coach_service.SafetyClassifierService")
@patch("app.services.coach_service.generate_llm_response_stream")
@patch("app.services.coach_service._get_confirmed_goal", new_callable=AsyncMock)
@patch("app.services.coach_service._get_patient")
@patch("app.services.coach_service.make_coach_tools")
@patch("app.services.coach_service._get_conversation_messages", new_callable=AsyncMock)
@patch("app.services.coach_service._build_system_prompt_for_phase")
@patch("app.services.coach_service._find_latest_unconfirmed_goal", new_callable=AsyncMock)
async def test_clinical_retry_fails_yields_fallback(
    mock_find_goal,
    mock_build_prompt,
    mock_msgs,
    mock_tools,
    mock_get_patient,
    mock_get_goal,
    mock_stream,
    mock_classifier_cls,
    mock_llm,
    db_session,
):
    """When retry also returns clinical content, a safe fallback is used."""
    patient = MagicMock()
    patient.phase = PatientPhase.ACTIVE
    patient.id = 1
    mock_get_patient.return_value = patient
    mock_get_goal.return_value = "Walk daily"
    mock_msgs.return_value = []
    mock_tools.return_value = []
    mock_build_prompt.return_value = "You are a helpful coach."
    mock_find_goal.return_value = None

    async def fake_stream(**kwargs):
        yield "You should see a specialist about your diagnosis"

    mock_stream.return_value = fake_stream()

    # Classifier: both calls return CLINICAL
    classifier_instance = MagicMock()
    classifier_instance.classify = AsyncMock(side_effect=[
        MagicMock(
            classification=SafetyClassification.CLINICAL_CONTENT,
            matched_patterns=["diagnosis"],
        ),
        MagicMock(
            classification=SafetyClassification.CLINICAL_CONTENT,
            matched_patterns=["specialist"],
        ),
    ])
    mock_classifier_cls.return_value = classifier_instance

    mock_llm.return_value = "Still talking about your diagnosis"

    events = await _collect_events(
        run_coach_turn_stream(db_session, 1, 1, "what about my diagnosis?")
    )

    override_events = [e for e in events if e["type"] == "safety_override"]
    assert len(override_events) == 1
    # Content should be one of the safe fallback messages, not the clinical text
    content = override_events[0]["data"]["content"]
    assert "diagnosis" not in content.lower()
    assert mock_llm.called


@pytest.mark.asyncio
@patch("app.services.coach_service.SafetyClassifierService")
@patch("app.services.coach_service.generate_llm_response_stream")
@patch("app.services.coach_service._get_confirmed_goal", new_callable=AsyncMock)
@patch("app.services.coach_service._get_patient")
@patch("app.services.coach_service.make_coach_tools")
@patch("app.services.coach_service._get_conversation_messages", new_callable=AsyncMock)
@patch("app.services.coach_service._build_system_prompt_for_phase")
@patch("app.services.coach_service._find_latest_unconfirmed_goal", new_callable=AsyncMock)
async def test_crisis_yields_safety_override_with_crisis_message(
    mock_find_goal,
    mock_build_prompt,
    mock_msgs,
    mock_tools,
    mock_get_patient,
    mock_get_goal,
    mock_stream,
    mock_classifier_cls,
    db_session,
):
    """A CRISIS classification yields a safety_override with the crisis support message."""
    from app.services.safety_pipeline import CRISIS_SUPPORT_MESSAGE

    patient = MagicMock()
    patient.phase = PatientPhase.ACTIVE
    patient.id = 1
    mock_get_patient.return_value = patient
    mock_get_goal.return_value = "Walk daily"
    mock_msgs.return_value = []
    mock_tools.return_value = []
    mock_build_prompt.return_value = "You are a helpful coach."
    mock_find_goal.return_value = None

    async def fake_stream(**kwargs):
        yield "I feel hopeless and don't want to continue"

    mock_stream.return_value = fake_stream()

    classifier_instance = MagicMock()
    classifier_instance.classify = AsyncMock(return_value=MagicMock(
        classification=SafetyClassification.CRISIS,
        matched_patterns=["hopeless"],
    ))
    mock_classifier_cls.return_value = classifier_instance

    events = await _collect_events(
        run_coach_turn_stream(db_session, 1, 1, "I feel hopeless")
    )

    override_events = [e for e in events if e["type"] == "safety_override"]
    assert len(override_events) == 1
    assert override_events[0]["data"]["content"] == CRISIS_SUPPORT_MESSAGE
