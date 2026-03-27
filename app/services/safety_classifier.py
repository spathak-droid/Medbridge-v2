"""Safety classifier service — TICKET-008.

Dual-layer approach for classifying coach/patient messages:
1. Fast keyword/pattern layer — catches clear clinical and crisis content
2. LLM fallback — for ambiguous cases (optional, configurable)

Crisis detection prioritises high recall: false positives are acceptable,
false negatives are not.

Classification results are stored on the Message model (safety_status field)
and logged for audit trail (compliance requirement).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from app.models.enums import SafetyClassification

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Crisis keyword patterns — comprehensive list referencing established
# crisis keyword lists (Columbia Protocol, QPR, crisis text line).
# High recall: broad patterns, case-insensitive matching.
# ---------------------------------------------------------------------------
CRISIS_PATTERNS: list[re.Pattern[str]] = [
    # Self-harm
    re.compile(r"\bhurt\s+(myself|me)\b", re.IGNORECASE),
    re.compile(r"\bharm\s+(myself|me)\b", re.IGNORECASE),
    re.compile(r"\bcutting\s+(myself|me)\b", re.IGNORECASE),
    re.compile(r"\bself[- ]?harm\b", re.IGNORECASE),
    # Suicidal ideation
    re.compile(r"\bsuicid(e|al|ality)\b", re.IGNORECASE),
    re.compile(r"\bkill(ing)?\s+(myself|me)\b", re.IGNORECASE),
    re.compile(r"\bend\s+(my|this)\s+life\b", re.IGNORECASE),
    re.compile(r"\bdon'?t\s+want\s+to\s+live\b", re.IGNORECASE),
    re.compile(r"\bno\s+reason\s+(to|for)\s+(keep\s+going|live|living|me)\b", re.IGNORECASE),
    re.compile(r"\bbetter\s+off\s+dead\b", re.IGNORECASE),
    re.compile(r"\bwish\s+i\s+was\s+dead\b", re.IGNORECASE),
    re.compile(r"\bwant\s+to\s+die\b", re.IGNORECASE),
    # Overdose
    re.compile(r"\btaking\s+all\s+my\s+pills\b", re.IGNORECASE),
    re.compile(r"\boverdos(e|ing)\b", re.IGNORECASE),
    # Hopelessness combined with finality
    re.compile(r"\bno\s+reason\s+for\s+me\s+to\b", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Clinical content patterns — medication, diagnosis, treatment, symptoms.
# ---------------------------------------------------------------------------
CLINICAL_PATTERNS: list[re.Pattern[str]] = [
    # Medication / dosage — specific drug names and prescribing language
    re.compile(
        r"\b(prescri\w+|medication|ibuprofen|acetaminophen|aspirin|naproxen"
        r"|opioid|antibiotic|steroid|dosage|\d+\s*mg)\b",
        re.IGNORECASE,
    ),
    # Diagnosis language — coach making a diagnosis
    re.compile(
        r"\b(diagnosed?\s+with|sounds?\s+like\s+you\s+have"
        r"|this\s+could\s+be\s+\w+itis|this\s+is\s+likely\s+a|it\s+appears?\s+to\s+be\s+a)\b",
        re.IGNORECASE,
    ),
    # Specific conditions (when coach names them as a diagnosis)
    re.compile(
        r"\b(tendinitis|tendonitis|plantar\s+fasciitis|herniat\w+\s+disc"
        r"|torn\s+meniscus|fracture|bursitis"
        r"|sciatica|scoliosis|osteoporosis)\b",
        re.IGNORECASE,
    ),
    # Treatment beyond exercise — coach recommending or prescribing treatments
    re.compile(
        r"\byou\s+(need|should|might\s+need|require|could\s+benefit\s+from)"
        r"\s+(\w+\s+){0,3}(surgery|an?\s+MRI|an?\s+x-ray|an?\s+CT\s+scan|an?\s+ultrasound"
        r"|a?\s+cortisone\s+injection|a?\s+referral)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(recommend\w*|schedule|prescrib\w+|order\w*)\s+(\w+\s+){0,3}"
        r"(surgery|an?\s+MRI|an?\s+x-ray|an?\s+CT\s+scan|an?\s+ultrasound"
        r"|a?\s+cortisone|a?\s+referral)\b",
        re.IGNORECASE,
    ),
    # Symptom interpretation — coach interpreting symptoms
    re.compile(
        r"\b(this\s+means?\s+your\s+\w+\s+is|indicates?\s+\w+\s+in\s+the?\s+\w+"
        r"|ligament\s+is\s+damaged|inflammation\s+in\s+(the|your))\b",
        re.IGNORECASE,
    ),
    # Prognosis — coach predicting medical outcomes
    re.compile(
        r"\b(your\s+condition\s+will|prognosis\s+is|will\s+likely\s+resolve"
        r"|recovery\s+time\s+is\s+\d|heal\s+in\s+\d+)\b",
        re.IGNORECASE,
    ),
    # Prescription
    re.compile(r"\bprescription\b", re.IGNORECASE),
]


SAFETY_CLASSIFICATION_PROMPT = (
    "You are a safety classifier for a rehabilitation coaching AI. "
    "Classify the following AI coach response as one of: SAFE, CLINICAL_CONTENT, CRISIS.\n\n"
    "CRISIS: contains references to self-harm, suicidal ideation, or immediate danger.\n"
    "CLINICAL_CONTENT: contains specific medical advice, diagnoses, medication "
    "recommendations, dosage information, or prognosis statements.\n"
    "SAFE: appropriate motivational coaching content about exercises, goals, and emotional support.\n\n"
    "Respond with ONLY the classification label on the first line, then a brief reason on the second line."
)


@dataclass
class ClassificationResult:
    """Result of safety classification, carrying audit metadata.

    Attributes:
        classification: The safety classification (SAFE, CLINICAL_CONTENT, CRISIS).
        matched_patterns: List of pattern descriptions that triggered the classification.
        layer: Which layer made the classification ('keyword' or 'llm').
        message: The original message text (for audit logging).
    """

    classification: SafetyClassification
    matched_patterns: list[str] = field(default_factory=list)
    layer: str = "keyword"
    message: str = ""


class SafetyClassifierService:
    """Stateless safety classifier for coach/patient messages.

    Usage:
        classifier = SafetyClassifierService()
        result = classifier.classify("You should take ibuprofen.")
        # result.classification == SafetyClassification.CLINICAL_CONTENT

    The LLM fallback is optional and disabled by default for fast synchronous
    classification. Enable via `enable_llm_fallback=True` for ambiguous cases.
    """

    def __init__(self, *, enable_llm_fallback: bool = False) -> None:
        self._enable_llm_fallback = enable_llm_fallback

    async def classify(self, message: str) -> ClassificationResult:
        """Classify a message for safety concerns.

        Priority order: CRISIS > CLINICAL_CONTENT > SAFE.
        Crisis detection runs first for high recall.
        """
        if not message or not message.strip():
            return ClassificationResult(
                classification=SafetyClassification.SAFE,
                matched_patterns=[],
                layer="keyword",
                message=message,
            )

        # Layer 1: Fast keyword/pattern matching
        crisis_matches = self._check_crisis(message)
        if crisis_matches:
            result = ClassificationResult(
                classification=SafetyClassification.CRISIS,
                matched_patterns=crisis_matches,
                layer="keyword",
                message=message,
            )
            logger.warning(
                "CRISIS detected: patterns=%s message_length=%d",
                crisis_matches,
                len(message),
            )
            return result

        clinical_matches = self._check_clinical(message)
        if clinical_matches:
            result = ClassificationResult(
                classification=SafetyClassification.CLINICAL_CONTENT,
                matched_patterns=clinical_matches,
                layer="keyword",
                message=message,
            )
            logger.info(
                "CLINICAL_CONTENT detected: patterns=%s message_length=%d",
                clinical_matches,
                len(message),
            )
            return result

        # Layer 2: LLM fallback for ambiguous cases (if enabled)
        if self._enable_llm_fallback:
            return await self._llm_classify(message)

        # Default: safe
        result = ClassificationResult(
            classification=SafetyClassification.SAFE,
            matched_patterns=[],
            layer="keyword",
            message=message,
        )
        logger.debug("SAFE: message_length=%d", len(message))
        return result

    def _check_crisis(self, message: str) -> list[str]:
        """Check message against crisis patterns. Returns matched pattern descriptions."""
        matches: list[str] = []
        for pattern in CRISIS_PATTERNS:
            if pattern.search(message):
                matches.append(pattern.pattern)
        return matches

    def _check_clinical(self, message: str) -> list[str]:
        """Check message against clinical content patterns."""
        matches: list[str] = []
        for pattern in CLINICAL_PATTERNS:
            if pattern.search(message):
                matches.append(pattern.pattern)
        return matches

    async def _llm_classify(self, message: str) -> ClassificationResult:
        """LLM fallback classifier for ambiguous messages.

        Calls the LLM to classify messages that passed regex but may still
        contain clinical content or crisis signals via paraphrasing.
        """
        from app.services.llm_provider import generate_llm_response

        logger.info("LLM fallback invoked for message_length=%d", len(message))
        try:
            response = await generate_llm_response(
                messages=[{"role": "user", "content": message}],
                system_prompt=SAFETY_CLASSIFICATION_PROMPT,
                patient_id=0,  # classifier context, not patient-specific
            )
            return self._parse_llm_classification(response, message)
        except Exception:
            logger.exception("LLM safety classification failed, defaulting to SAFE")
            return ClassificationResult(
                classification=SafetyClassification.SAFE,
                matched_patterns=[],
                layer="llm",
                message=message,
            )

    @staticmethod
    def _parse_llm_classification(response: str, original_message: str) -> ClassificationResult:
        """Parse the LLM classification response into a ClassificationResult."""
        lines = response.strip().split("\n", 1)
        label = lines[0].strip().upper()
        reason = lines[1].strip() if len(lines) > 1 else ""

        classification_map = {
            "SAFE": SafetyClassification.SAFE,
            "CLINICAL_CONTENT": SafetyClassification.CLINICAL_CONTENT,
            "CRISIS": SafetyClassification.CRISIS,
        }

        classification = classification_map.get(label, SafetyClassification.SAFE)
        matched_patterns = [f"llm: {reason}"] if reason else []

        return ClassificationResult(
            classification=classification,
            matched_patterns=matched_patterns,
            layer="llm",
            message=original_message,
        )
