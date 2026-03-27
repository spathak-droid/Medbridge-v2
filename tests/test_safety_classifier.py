"""Tests for TICKET-008: safety classifier for clinical content and crisis detection.

Dual-layer approach: fast keyword check + LLM fallback for ambiguous cases.
Test corpus of 25+ messages covering all acceptance criteria:
- Safe exercise-focused messages -> SAFE
- Medication advice -> CLINICAL_CONTENT
- Diagnosis language -> CLINICAL_CONTENT
- Treatment beyond exercise -> CLINICAL_CONTENT
- Symptom interpretation -> CLINICAL_CONTENT
- Mental health crisis signals -> CRISIS
- Borderline wellness encouragement -> SAFE
- Crisis detection is high-recall (false positives acceptable)
- Classification results carry audit metadata
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.models.enums import SafetyClassification
from app.services.safety_classifier import ClassificationResult, SafetyClassifierService


class TestSafeMessages:
    """AC1/AC7: Messages with no clinical content return SAFE."""

    @pytest.mark.asyncio
    async def test_exercise_encouragement(self):
        """AC1: No clinical content -> SAFE."""
        svc = SafetyClassifierService()
        result = await svc.classify("Great job on your exercises today! Keep it up!")
        assert result.classification == SafetyClassification.SAFE

    @pytest.mark.asyncio
    async def test_general_wellness(self):
        """AC7: Borderline wellness encouragement -> SAFE."""
        svc = SafetyClassifierService()
        result = await svc.classify(
            "Remember to stay hydrated and get plenty of rest tonight."
        )
        assert result.classification == SafetyClassification.SAFE

    @pytest.mark.asyncio
    async def test_exercise_motivation(self):
        svc = SafetyClassifierService()
        result = await svc.classify(
            "You're making amazing progress with your rehab exercises!"
        )
        assert result.classification == SafetyClassification.SAFE

    @pytest.mark.asyncio
    async def test_goal_setting(self):
        svc = SafetyClassifierService()
        result = await svc.classify(
            "Let's set a goal to complete your exercises 5 times this week."
        )
        assert result.classification == SafetyClassification.SAFE

    @pytest.mark.asyncio
    async def test_adherence_praise(self):
        svc = SafetyClassifierService()
        result = await svc.classify(
            "Your adherence this week is 80% — that's fantastic work!"
        )
        assert result.classification == SafetyClassification.SAFE

    @pytest.mark.asyncio
    async def test_schedule_reminder(self):
        svc = SafetyClassifierService()
        result = await svc.classify("Your next session is scheduled for Thursday at 2pm.")
        assert result.classification == SafetyClassification.SAFE

    @pytest.mark.asyncio
    async def test_pain_scale_question(self):
        """Asking about pain level is safe coaching, not symptom interpretation."""
        svc = SafetyClassifierService()
        result = await svc.classify("On a scale of 1-10, how would you rate your pain today?")
        assert result.classification == SafetyClassification.SAFE

    @pytest.mark.asyncio
    async def test_pt_exercise_instructions(self):
        """Exercise instructions are safe."""
        svc = SafetyClassifierService()
        result = await svc.classify(
            "For your knee, try gentle quad sets: tighten your thigh muscle and hold for 5 seconds."
        )
        assert result.classification == SafetyClassification.SAFE

    @pytest.mark.asyncio
    async def test_empty_message(self):
        """Edge case: empty message is safe."""
        svc = SafetyClassifierService()
        result = await svc.classify("")
        assert result.classification == SafetyClassification.SAFE


class TestClinicalContent:
    """AC2/AC3/AC4/AC6: Clinical content returns CLINICAL_CONTENT."""

    @pytest.mark.asyncio
    async def test_medication_advice(self):
        """AC2: Medication advice -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify("You should take ibuprofen for the pain.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_dosage_advice(self):
        """AC2: Dosage recommendation -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify("Take 400mg of acetaminophen twice a day.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_diagnosis_language(self):
        """AC3: Diagnosis language -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify("It sounds like you have tendinitis.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_diagnosis_with_condition(self):
        """AC3: Naming a specific condition -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify(
            "Based on what you're describing, this could be plantar fasciitis."
        )
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_treatment_recommendation(self):
        """AC4: Treatment beyond exercise -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify("I recommend you get an MRI to check your ligament.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_cortisone_injection(self):
        """AC4: Injectable treatment -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify(
            "You should consider getting a cortisone injection for that."
        )
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_symptom_interpretation(self):
        """AC6: Symptom interpretation -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify("That pain means your ligament is damaged.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_symptom_analysis(self):
        """AC6: Interpreting symptoms -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify(
            "The swelling you're describing indicates inflammation in the joint."
        )
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_prognosis(self):
        """Clinical: prognosis language -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify(
            "Based on your symptoms, this condition will likely resolve in 6 weeks."
        )
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_surgery_recommendation(self):
        """AC4: Surgery -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify("You may need surgery to repair the torn meniscus.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_prescription_suggestion(self):
        """Clinical: prescription -> CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = await svc.classify("You might need a prescription for stronger pain relief.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT


class TestCrisisDetection:
    """AC5: Mental health crisis signals return CRISIS. High recall required."""

    @pytest.mark.asyncio
    async def test_self_harm(self):
        """AC5: Self-harm -> CRISIS."""
        svc = SafetyClassifierService()
        result = await svc.classify("I want to hurt myself.")
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_suicidal_ideation(self):
        svc = SafetyClassifierService()
        result = await svc.classify("I don't want to live anymore.")
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_suicide_mention(self):
        svc = SafetyClassifierService()
        result = await svc.classify("I've been thinking about suicide.")
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_ending_life(self):
        svc = SafetyClassifierService()
        result = await svc.classify("I want to end my life.")
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_kill_myself(self):
        svc = SafetyClassifierService()
        result = await svc.classify("Sometimes I think about killing myself.")
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_self_harm_cutting(self):
        svc = SafetyClassifierService()
        result = await svc.classify("I've been cutting myself to cope with the pain.")
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_hopelessness_with_death_wish(self):
        svc = SafetyClassifierService()
        result = await svc.classify("Everything is hopeless. I'd be better off dead.")
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_overdose_intent(self):
        svc = SafetyClassifierService()
        result = await svc.classify("I'm thinking about taking all my pills at once.")
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_no_reason_to_live(self):
        svc = SafetyClassifierService()
        result = await svc.classify("There's no reason for me to keep going.")
        assert result.classification == SafetyClassification.CRISIS


class TestClassificationResult:
    """ClassificationResult carries metadata for audit trail."""

    @pytest.mark.asyncio
    async def test_result_has_classification(self):
        svc = SafetyClassifierService()
        result = await svc.classify("Hello, how are you?")
        assert isinstance(result, ClassificationResult)
        assert isinstance(result.classification, SafetyClassification)

    @pytest.mark.asyncio
    async def test_result_has_matched_patterns(self):
        svc = SafetyClassifierService()
        result = await svc.classify("You should take ibuprofen for the pain.")
        assert isinstance(result.matched_patterns, list)
        assert len(result.matched_patterns) > 0

    @pytest.mark.asyncio
    async def test_result_has_layer(self):
        """Layer indicates keyword or llm classification."""
        svc = SafetyClassifierService()
        result = await svc.classify("You should take ibuprofen for the pain.")
        assert result.layer in ("keyword", "llm")

    @pytest.mark.asyncio
    async def test_safe_result_has_empty_patterns(self):
        svc = SafetyClassifierService()
        result = await svc.classify("Keep up the good work!")
        assert result.matched_patterns == []

    @pytest.mark.asyncio
    async def test_result_has_message(self):
        """Original message stored for audit logging."""
        svc = SafetyClassifierService()
        msg = "You should take ibuprofen."
        result = await svc.classify(msg)
        assert result.message == msg


class TestPriorityAndEdgeCases:
    """Crisis takes priority over clinical; case insensitivity; edge cases."""

    @pytest.mark.asyncio
    async def test_crisis_priority_over_clinical(self):
        """If both crisis and clinical patterns match, crisis wins."""
        svc = SafetyClassifierService()
        result = await svc.classify(
            "I want to hurt myself and I think I need medication."
        )
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_case_insensitive_crisis(self):
        svc = SafetyClassifierService()
        result = await svc.classify("I WANT TO HURT MYSELF")
        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    async def test_case_insensitive_clinical(self):
        svc = SafetyClassifierService()
        result = await svc.classify("YOU SHOULD TAKE IBUPROFEN")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    @pytest.mark.asyncio
    async def test_exercise_advice_not_clinical(self):
        """Exercise guidance should NOT trigger clinical flag."""
        svc = SafetyClassifierService()
        result = await svc.classify(
            "Try doing 10 reps of the leg raise exercise we discussed."
        )
        assert result.classification == SafetyClassification.SAFE


class TestLLMFallback:
    """Tests for the LLM safety classifier fallback."""

    @pytest.mark.asyncio
    @patch("app.services.llm_provider.generate_llm_response", new_callable=AsyncMock)
    async def test_llm_called_when_regex_safe_and_fallback_enabled(self, mock_llm):
        """When regex returns SAFE and LLM fallback is enabled, LLM is called."""
        mock_llm.return_value = "SAFE\nAppropriate exercise motivation"

        svc = SafetyClassifierService(enable_llm_fallback=True)
        result = await svc.classify("Keep working on those exercises!")

        assert mock_llm.called
        assert result.classification == SafetyClassification.SAFE
        assert result.layer == "llm"

    @pytest.mark.asyncio
    @patch("app.services.llm_provider.generate_llm_response", new_callable=AsyncMock)
    async def test_llm_catches_subtle_clinical_content(self, mock_llm):
        """LLM detects clinical content that bypasses regex."""
        mock_llm.return_value = "CLINICAL_CONTENT\nContains paraphrased medical advice about treatment"

        svc = SafetyClassifierService(enable_llm_fallback=True)
        result = await svc.classify(
            "Based on what you're describing, your tissue might need a different approach to healing."
        )

        assert result.classification == SafetyClassification.CLINICAL_CONTENT
        assert result.layer == "llm"

    @pytest.mark.asyncio
    @patch("app.services.llm_provider.generate_llm_response", new_callable=AsyncMock)
    async def test_llm_catches_crisis(self, mock_llm):
        """LLM detects crisis language that bypasses regex patterns."""
        mock_llm.return_value = "CRISIS\nExpresses hopelessness and desire to give up on everything"

        svc = SafetyClassifierService(enable_llm_fallback=True)
        result = await svc.classify("I just feel like nothing matters anymore and there's no point")

        assert result.classification == SafetyClassification.CRISIS

    @pytest.mark.asyncio
    @patch("app.services.llm_provider.generate_llm_response", new_callable=AsyncMock)
    async def test_llm_error_defaults_to_safe(self, mock_llm):
        """If LLM call fails, classification defaults to SAFE."""
        mock_llm.side_effect = Exception("API error")

        svc = SafetyClassifierService(enable_llm_fallback=True)
        result = await svc.classify("Some message here")

        assert result.classification == SafetyClassification.SAFE
        assert result.layer == "llm"

    @pytest.mark.asyncio
    @patch("app.services.llm_provider.generate_llm_response", new_callable=AsyncMock)
    async def test_malformed_llm_response_defaults_to_safe(self, mock_llm):
        """Malformed LLM responses default to SAFE."""
        mock_llm.return_value = "I'm not sure how to classify this"

        svc = SafetyClassifierService(enable_llm_fallback=True)
        result = await svc.classify("Some message")

        assert result.classification == SafetyClassification.SAFE

    @pytest.mark.asyncio
    async def test_regex_crisis_bypasses_llm(self):
        """Crisis caught by regex does not trigger LLM call."""
        svc = SafetyClassifierService(enable_llm_fallback=True)
        result = await svc.classify("I want to hurt myself")

        assert result.classification == SafetyClassification.CRISIS
        assert result.layer == "keyword"  # regex, not LLM

    @pytest.mark.asyncio
    async def test_regex_clinical_bypasses_llm(self):
        """Clinical content caught by regex does not trigger LLM call."""
        svc = SafetyClassifierService(enable_llm_fallback=True)
        result = await svc.classify("You should take 400mg ibuprofen twice daily")

        assert result.classification == SafetyClassification.CLINICAL_CONTENT
        assert result.layer == "keyword"


class TestParseLLMClassification:
    """Tests for _parse_llm_classification static method."""

    def test_parse_safe(self):
        result = SafetyClassifierService._parse_llm_classification(
            "SAFE\nAppropriate content", "original"
        )
        assert result.classification == SafetyClassification.SAFE
        assert result.matched_patterns == ["llm: Appropriate content"]

    def test_parse_clinical(self):
        result = SafetyClassifierService._parse_llm_classification(
            "CLINICAL_CONTENT\nContains dosage info", "original"
        )
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_parse_crisis(self):
        result = SafetyClassifierService._parse_llm_classification(
            "CRISIS\nSelf-harm references", "original"
        )
        assert result.classification == SafetyClassification.CRISIS

    def test_parse_unknown_defaults_safe(self):
        result = SafetyClassifierService._parse_llm_classification(
            "UNKNOWN_LABEL\nSome reason", "original"
        )
        assert result.classification == SafetyClassification.SAFE

    def test_parse_no_reason(self):
        result = SafetyClassifierService._parse_llm_classification(
            "SAFE", "original"
        )
        assert result.classification == SafetyClassification.SAFE
        assert result.matched_patterns == []
