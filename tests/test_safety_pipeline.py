"""Tests for TICKET-009: safety enforcement pipeline with retry and fallback.

Covers all acceptance criteria:
- Message passes safety → delivered as-is
- CLINICAL_CONTENT → retry with augmented prompt
- Retry also fails → fallback to safe generic message
- CRISIS → alert_clinician with urgency=CRITICAL + safe message with crisis resources
- Blocked messages have safety_status set to BLOCKED or FALLBACK
- Total attempts never exceed 2 LLM calls
"""

from unittest.mock import AsyncMock

from app.models.enums import SafetyStatus
from app.services.safety_pipeline import (
    CRISIS_SUPPORT_MESSAGE,
    SAFE_FALLBACK_MESSAGES,
    SafetyPipelineResult,
    run_safety_pipeline,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_generate_fn(responses: list[str]) -> AsyncMock:
    """Create an async mock that returns successive responses."""
    fn = AsyncMock(side_effect=responses)
    return fn


# ---------------------------------------------------------------------------
# AC1: Message passes safety → delivered as-is
# ---------------------------------------------------------------------------


class TestPassingMessage:
    async def test_safe_message_delivered_as_is(self):
        generate_fn = _make_generate_fn(["Great job on your exercises today!"])
        result = await run_safety_pipeline(
            patient_id=1,
            generate_fn=generate_fn,
        )

        assert result.message == "Great job on your exercises today!"
        assert result.safety_status == SafetyStatus.PASSED
        assert result.attempts == 1
        assert result.crisis_alert_sent is False

    async def test_safe_message_calls_generate_once(self):
        generate_fn = _make_generate_fn(["Keep up the great work!"])
        await run_safety_pipeline(patient_id=1, generate_fn=generate_fn)
        assert generate_fn.call_count == 1


# ---------------------------------------------------------------------------
# AC2: CLINICAL_CONTENT → retry with augmented prompt
# ---------------------------------------------------------------------------


class TestRetryOnClinicalContent:
    async def test_retries_with_augmented_prompt_on_clinical(self):
        """First message is clinical, retry is safe → delivers retry."""
        generate_fn = _make_generate_fn([
            "You should take ibuprofen for the pain.",
            "Keep focusing on your exercise routine for recovery!",
        ])
        result = await run_safety_pipeline(
            patient_id=1,
            generate_fn=generate_fn,
        )

        assert result.message == "Keep focusing on your exercise routine for recovery!"
        assert result.safety_status == SafetyStatus.PASSED
        assert result.attempts == 2

    async def test_retry_prompt_includes_augmented_instruction(self):
        """The retry call should include the augmented safety prompt."""
        generate_fn = _make_generate_fn([
            "You should take ibuprofen.",
            "Stay motivated with your exercises!",
        ])
        await run_safety_pipeline(patient_id=1, generate_fn=generate_fn)

        # Second call should have augmented_prompt=True
        assert generate_fn.call_count == 2
        _, kwargs = generate_fn.call_args
        assert kwargs.get("augmented_prompt") is True


# ---------------------------------------------------------------------------
# AC3: Retry also fails → fallback to safe generic message
# ---------------------------------------------------------------------------


class TestFallbackOnDoubleFailure:
    async def test_double_clinical_returns_fallback(self):
        """Both attempts are clinical → delivers pre-written fallback."""
        generate_fn = _make_generate_fn([
            "Take ibuprofen for the pain.",
            "You probably have tendinitis based on those symptoms.",
        ])
        result = await run_safety_pipeline(
            patient_id=1,
            generate_fn=generate_fn,
        )

        assert result.message in SAFE_FALLBACK_MESSAGES
        assert result.safety_status == SafetyStatus.FALLBACK
        assert result.attempts == 2
        assert result.crisis_alert_sent is False

    async def test_fallback_never_exceeds_two_attempts(self):
        """Even on double failure, only 2 generate calls happen."""
        generate_fn = _make_generate_fn([
            "Take some aspirin.",
            "You need an MRI scan.",
        ])
        result = await run_safety_pipeline(
            patient_id=1,
            generate_fn=generate_fn,
        )

        assert generate_fn.call_count == 2
        assert result.attempts == 2


# ---------------------------------------------------------------------------
# AC4: CRISIS → alert_clinician with urgency=CRITICAL
# ---------------------------------------------------------------------------


class TestCrisisDetection:
    async def test_crisis_triggers_clinician_alert(self):
        """Crisis message → alert_clinician called with urgency=CRITICAL."""
        generate_fn = _make_generate_fn(["I want to hurt myself."])
        alert_fn = AsyncMock(return_value="Alert created")

        result = await run_safety_pipeline(
            patient_id=42,
            generate_fn=generate_fn,
            alert_clinician_fn=alert_fn,
        )

        assert result.crisis_alert_sent is True
        alert_fn.assert_called_once()
        call_kwargs = alert_fn.call_args[1]
        assert call_kwargs["patient_id"] == 42
        assert call_kwargs["urgency"] == "CRITICAL"

    async def test_crisis_delivers_supportive_message(self):
        """Crisis → patient receives safe message with crisis resources."""
        generate_fn = _make_generate_fn(["I don't want to live anymore."])
        alert_fn = AsyncMock(return_value="Alert created")

        result = await run_safety_pipeline(
            patient_id=1,
            generate_fn=generate_fn,
            alert_clinician_fn=alert_fn,
        )

        assert result.message == CRISIS_SUPPORT_MESSAGE
        assert result.safety_status == SafetyStatus.BLOCKED

    async def test_crisis_does_not_retry(self):
        """Crisis path should NOT retry — go straight to alert."""
        generate_fn = _make_generate_fn(["I've been thinking about suicide."])
        alert_fn = AsyncMock(return_value="Alert created")

        result = await run_safety_pipeline(
            patient_id=1,
            generate_fn=generate_fn,
            alert_clinician_fn=alert_fn,
        )

        assert generate_fn.call_count == 1
        assert result.attempts == 1


# ---------------------------------------------------------------------------
# AC5: safety_status is set correctly
# ---------------------------------------------------------------------------


class TestSafetyStatusValues:
    async def test_passed_status_on_safe(self):
        generate_fn = _make_generate_fn(["Great work today!"])
        result = await run_safety_pipeline(patient_id=1, generate_fn=generate_fn)
        assert result.safety_status == SafetyStatus.PASSED

    async def test_blocked_status_on_crisis(self):
        generate_fn = _make_generate_fn(["I want to end my life."])
        alert_fn = AsyncMock(return_value="Alert created")
        result = await run_safety_pipeline(
            patient_id=1, generate_fn=generate_fn, alert_clinician_fn=alert_fn
        )
        assert result.safety_status == SafetyStatus.BLOCKED

    async def test_fallback_status_on_double_clinical(self):
        generate_fn = _make_generate_fn([
            "Take aspirin for pain.",
            "You need a cortisone injection.",
        ])
        result = await run_safety_pipeline(patient_id=1, generate_fn=generate_fn)
        assert result.safety_status == SafetyStatus.FALLBACK

    async def test_passed_status_after_successful_retry(self):
        generate_fn = _make_generate_fn([
            "You should take ibuprofen.",
            "Keep doing your stretches!",
        ])
        result = await run_safety_pipeline(patient_id=1, generate_fn=generate_fn)
        assert result.safety_status == SafetyStatus.PASSED


# ---------------------------------------------------------------------------
# AC6: Max 2 LLM calls
# ---------------------------------------------------------------------------


class TestMaxAttempts:
    async def test_max_two_attempts_on_clinical(self):
        generate_fn = _make_generate_fn([
            "Take medication.",
            "See a specialist.",
        ])
        result = await run_safety_pipeline(patient_id=1, generate_fn=generate_fn)
        assert result.attempts <= 2
        assert generate_fn.call_count <= 2

    async def test_one_attempt_on_safe(self):
        generate_fn = _make_generate_fn(["You're doing great!"])
        result = await run_safety_pipeline(patient_id=1, generate_fn=generate_fn)
        assert result.attempts == 1

    async def test_one_attempt_on_crisis(self):
        generate_fn = _make_generate_fn(["I want to hurt myself."])
        alert_fn = AsyncMock(return_value="Alert created")
        result = await run_safety_pipeline(
            patient_id=1, generate_fn=generate_fn, alert_clinician_fn=alert_fn
        )
        assert result.attempts == 1


# ---------------------------------------------------------------------------
# SafetyPipelineResult dataclass
# ---------------------------------------------------------------------------


class TestSafetyPipelineResult:
    def test_result_has_expected_fields(self):
        result = SafetyPipelineResult(
            message="Hello",
            safety_status=SafetyStatus.PASSED,
            attempts=1,
            crisis_alert_sent=False,
        )
        assert result.message == "Hello"
        assert result.safety_status == SafetyStatus.PASSED
        assert result.attempts == 1
        assert result.crisis_alert_sent is False


# ---------------------------------------------------------------------------
# Fallback message rotation
# ---------------------------------------------------------------------------


class TestFallbackRotation:
    async def test_fallback_messages_are_from_approved_set(self):
        """Fallback messages should be from the pre-approved set."""
        generate_fn = _make_generate_fn([
            "Take ibuprofen.",
            "You have tendinitis.",
        ])
        result = await run_safety_pipeline(patient_id=1, generate_fn=generate_fn)
        assert result.message in SAFE_FALLBACK_MESSAGES
