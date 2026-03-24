"""Safety enforcement pipeline — TICKET-009.

Wraps every coach message generation with safety classification.
Pipeline flow: generate → classify → (pass | retry → classify → pass/fallback | crisis → alert).

- Max 2 LLM calls per message (original + one retry).
- If blocked twice, falls back to a pre-written safe generic message.
- Crisis signals trigger immediate clinician alert with urgency=CRITICAL.
- Updates Message.safety_status to PASSED/BLOCKED/FALLBACK.

Designed as a reusable function that any subgraph node can call.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Callable

from app.models.enums import SafetyClassification, SafetyStatus
from app.services.safety_classifier import SafetyClassifierService

import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pre-written safe fallback messages (rotated to avoid repetition)
# ---------------------------------------------------------------------------

SAFE_FALLBACK_MESSAGES: list[str] = [
    (
        "I'm here to help with your exercise goals! "
        "For medical questions, please reach out to your care team."
    ),
    (
        "I'm happy to support your rehabilitation journey! "
        "For clinical concerns, your care team is the best resource."
    ),
    (
        "Let's keep focusing on your exercise progress! "
        "Please contact your care team for any medical questions."
    ),
    (
        "I'm here to cheer you on with your exercises! "
        "Your care team can help with any health-related questions."
    ),
]

# ---------------------------------------------------------------------------
# Crisis support message with crisis resources
# ---------------------------------------------------------------------------

CRISIS_SUPPORT_MESSAGE: str = (
    "I care about your well-being. If you're in crisis or having thoughts of "
    "self-harm, please reach out for support right away:\n\n"
    "• 988 Suicide & Crisis Lifeline: call or text 988\n"
    "• Crisis Text Line: text HOME to 741741\n\n"
    "Your care team has been notified and will follow up with you."
)

# Augmented retry prompt per ticket spec
AUGMENTED_RETRY_INSTRUCTION: str = (
    "Your previous response contained clinical content. "
    "Rephrase focusing only on exercise motivation and support."
)


@dataclass
class SafetyPipelineResult:
    """Result of the safety enforcement pipeline."""

    message: str
    safety_status: SafetyStatus
    attempts: int
    crisis_alert_sent: bool


async def run_safety_pipeline(
    *,
    patient_id: int,
    generate_fn: Callable,
    alert_clinician_fn: Callable | None = None,
    classifier: SafetyClassifierService | None = None,
) -> SafetyPipelineResult:
    """Run the safety enforcement pipeline around message generation.

    Args:
        patient_id: The patient ID for alert routing.
        generate_fn: Async callable that generates a coach message.
            Called as ``await generate_fn()`` on first attempt and
            ``await generate_fn(augmented_prompt=True)`` on retry.
        alert_clinician_fn: Optional async callable to alert clinician on crisis.
            Called as ``await alert_clinician_fn(patient_id=..., reason=..., urgency=...)``.
        classifier: Optional SafetyClassifierService instance (default creates one).

    Returns:
        SafetyPipelineResult with the final message, safety status, attempt count,
        and whether a crisis alert was sent.
    """
    if classifier is None:
        classifier = SafetyClassifierService()

    # Langfuse tracing (best-effort)
    lf_span = None
    try:
        from app.services.llm_provider import _langfuse
        lf = _langfuse()
        if lf:
            lf_span = lf.trace(
                name="safety-pipeline",
                metadata={"patient_id": patient_id},
            )
    except Exception:
        pass

    # --- Attempt 1: generate and classify ---
    message = await generate_fn()
    classification = classifier.classify(message)
    attempts = 1

    try:
        if lf_span:
            lf_span.span(
                name="safety-classify-attempt-1",
                input={"message": message[:300]},
                output={
                    "classification": classification.classification.value,
                    "matched_patterns": classification.matched_patterns,
                },
            )
    except Exception:
        pass

    # Crisis path — immediate alert, no retry
    if classification.classification == SafetyClassification.CRISIS:
        crisis_alert_sent = False
        if alert_clinician_fn is not None:
            await alert_clinician_fn(
                patient_id=patient_id,
                reason=f"Crisis signal detected in generated message: {message[:200]}",
                urgency="CRITICAL",
            )
            crisis_alert_sent = True

        result = SafetyPipelineResult(
            message=CRISIS_SUPPORT_MESSAGE,
            safety_status=SafetyStatus.BLOCKED,
            attempts=attempts,
            crisis_alert_sent=crisis_alert_sent,
        )
        try:
            if lf_span:
                lf_span.update(output={"safety_status": "BLOCKED", "attempts": 1, "crisis_alert_sent": crisis_alert_sent})
        except Exception:
            pass
        return result

    # Pass path — message is safe
    if classification.classification == SafetyClassification.SAFE:
        try:
            if lf_span:
                lf_span.update(output={"safety_status": "PASSED", "attempts": 1})
        except Exception:
            pass
        return SafetyPipelineResult(
            message=message,
            safety_status=SafetyStatus.PASSED,
            attempts=attempts,
            crisis_alert_sent=False,
        )

    # --- Attempt 2: retry with augmented prompt ---
    message = await generate_fn(augmented_prompt=True)
    classification = classifier.classify(message)
    attempts = 2

    try:
        if lf_span:
            lf_span.span(
                name="safety-classify-attempt-2",
                input={"message": message[:300], "augmented_prompt": True},
                output={
                    "classification": classification.classification.value,
                    "matched_patterns": classification.matched_patterns,
                },
            )
    except Exception:
        pass

    # Crisis on retry — alert immediately
    if classification.classification == SafetyClassification.CRISIS:
        crisis_alert_sent = False
        if alert_clinician_fn is not None:
            await alert_clinician_fn(
                patient_id=patient_id,
                reason=f"Crisis signal detected in retry message: {message[:200]}",
                urgency="CRITICAL",
            )
            crisis_alert_sent = True

        result = SafetyPipelineResult(
            message=CRISIS_SUPPORT_MESSAGE,
            safety_status=SafetyStatus.BLOCKED,
            attempts=attempts,
            crisis_alert_sent=crisis_alert_sent,
        )
    elif classification.classification == SafetyClassification.SAFE:
        # Retry passed — deliver
        result = SafetyPipelineResult(
            message=message,
            safety_status=SafetyStatus.PASSED,
            attempts=attempts,
            crisis_alert_sent=False,
        )
    else:
        # Retry also clinical — fallback to safe generic message
        fallback_message = random.choice(SAFE_FALLBACK_MESSAGES)
        result = SafetyPipelineResult(
            message=fallback_message,
            safety_status=SafetyStatus.FALLBACK,
            attempts=attempts,
            crisis_alert_sent=False,
        )

    try:
        if lf_span:
            lf_span.update(output={
                "safety_status": result.safety_status.value,
                "attempts": result.attempts,
                "crisis_alert_sent": result.crisis_alert_sent,
            })
    except Exception:
        pass

    return result
