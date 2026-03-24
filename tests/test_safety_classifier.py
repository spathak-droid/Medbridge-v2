"""Tests for TICKET-008: safety classifier for clinical content and crisis detection.

Dual-layer approach: fast keyword check + LLM fallback for ambiguous cases.
Test corpus of 25+ messages covering all acceptance criteria:
- Safe exercise-focused messages → SAFE
- Medication advice → CLINICAL_CONTENT
- Diagnosis language → CLINICAL_CONTENT
- Treatment beyond exercise → CLINICAL_CONTENT
- Symptom interpretation → CLINICAL_CONTENT
- Mental health crisis signals → CRISIS
- Borderline wellness encouragement → SAFE
- Crisis detection is high-recall (false positives acceptable)
- Classification results carry audit metadata
"""

from app.models.enums import SafetyClassification
from app.services.safety_classifier import ClassificationResult, SafetyClassifierService


class TestSafeMessages:
    """AC1/AC7: Messages with no clinical content return SAFE."""

    def test_exercise_encouragement(self):
        """AC1: No clinical content → SAFE."""
        svc = SafetyClassifierService()
        result = svc.classify("Great job on your exercises today! Keep it up!")
        assert result.classification == SafetyClassification.SAFE

    def test_general_wellness(self):
        """AC7: Borderline wellness encouragement → SAFE."""
        svc = SafetyClassifierService()
        result = svc.classify(
            "Remember to stay hydrated and get plenty of rest tonight."
        )
        assert result.classification == SafetyClassification.SAFE

    def test_exercise_motivation(self):
        svc = SafetyClassifierService()
        result = svc.classify(
            "You're making amazing progress with your rehab exercises!"
        )
        assert result.classification == SafetyClassification.SAFE

    def test_goal_setting(self):
        svc = SafetyClassifierService()
        result = svc.classify(
            "Let's set a goal to complete your exercises 5 times this week."
        )
        assert result.classification == SafetyClassification.SAFE

    def test_adherence_praise(self):
        svc = SafetyClassifierService()
        result = svc.classify(
            "Your adherence this week is 80% — that's fantastic work!"
        )
        assert result.classification == SafetyClassification.SAFE

    def test_schedule_reminder(self):
        svc = SafetyClassifierService()
        result = svc.classify("Your next session is scheduled for Thursday at 2pm.")
        assert result.classification == SafetyClassification.SAFE

    def test_pain_scale_question(self):
        """Asking about pain level is safe coaching, not symptom interpretation."""
        svc = SafetyClassifierService()
        result = svc.classify("On a scale of 1-10, how would you rate your pain today?")
        assert result.classification == SafetyClassification.SAFE

    def test_pt_exercise_instructions(self):
        """Exercise instructions are safe."""
        svc = SafetyClassifierService()
        result = svc.classify(
            "For your knee, try gentle quad sets: tighten your thigh muscle and hold for 5 seconds."
        )
        assert result.classification == SafetyClassification.SAFE

    def test_empty_message(self):
        """Edge case: empty message is safe."""
        svc = SafetyClassifierService()
        result = svc.classify("")
        assert result.classification == SafetyClassification.SAFE


class TestClinicalContent:
    """AC2/AC3/AC4/AC6: Clinical content returns CLINICAL_CONTENT."""

    def test_medication_advice(self):
        """AC2: Medication advice → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify("You should take ibuprofen for the pain.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_dosage_advice(self):
        """AC2: Dosage recommendation → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify("Take 400mg of acetaminophen twice a day.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_diagnosis_language(self):
        """AC3: Diagnosis language → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify("It sounds like you have tendinitis.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_diagnosis_with_condition(self):
        """AC3: Naming a specific condition → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify(
            "Based on what you're describing, this could be plantar fasciitis."
        )
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_treatment_recommendation(self):
        """AC4: Treatment beyond exercise → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify("I recommend you get an MRI to check your ligament.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_cortisone_injection(self):
        """AC4: Injectable treatment → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify(
            "You should consider getting a cortisone injection for that."
        )
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_symptom_interpretation(self):
        """AC6: Symptom interpretation → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify("That pain means your ligament is damaged.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_symptom_analysis(self):
        """AC6: Interpreting symptoms → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify(
            "The swelling you're describing indicates inflammation in the joint."
        )
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_prognosis(self):
        """Clinical: prognosis language → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify(
            "Based on your symptoms, this condition will likely resolve in 6 weeks."
        )
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_surgery_recommendation(self):
        """AC4: Surgery → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify("You may need surgery to repair the torn meniscus.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_prescription_suggestion(self):
        """Clinical: prescription → CLINICAL_CONTENT."""
        svc = SafetyClassifierService()
        result = svc.classify("You might need a prescription for stronger pain relief.")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT


class TestCrisisDetection:
    """AC5: Mental health crisis signals return CRISIS. High recall required."""

    def test_self_harm(self):
        """AC5: Self-harm → CRISIS."""
        svc = SafetyClassifierService()
        result = svc.classify("I want to hurt myself.")
        assert result.classification == SafetyClassification.CRISIS

    def test_suicidal_ideation(self):
        svc = SafetyClassifierService()
        result = svc.classify("I don't want to live anymore.")
        assert result.classification == SafetyClassification.CRISIS

    def test_suicide_mention(self):
        svc = SafetyClassifierService()
        result = svc.classify("I've been thinking about suicide.")
        assert result.classification == SafetyClassification.CRISIS

    def test_ending_life(self):
        svc = SafetyClassifierService()
        result = svc.classify("I want to end my life.")
        assert result.classification == SafetyClassification.CRISIS

    def test_kill_myself(self):
        svc = SafetyClassifierService()
        result = svc.classify("Sometimes I think about killing myself.")
        assert result.classification == SafetyClassification.CRISIS

    def test_self_harm_cutting(self):
        svc = SafetyClassifierService()
        result = svc.classify("I've been cutting myself to cope with the pain.")
        assert result.classification == SafetyClassification.CRISIS

    def test_hopelessness_with_death_wish(self):
        svc = SafetyClassifierService()
        result = svc.classify("Everything is hopeless. I'd be better off dead.")
        assert result.classification == SafetyClassification.CRISIS

    def test_overdose_intent(self):
        svc = SafetyClassifierService()
        result = svc.classify("I'm thinking about taking all my pills at once.")
        assert result.classification == SafetyClassification.CRISIS

    def test_no_reason_to_live(self):
        svc = SafetyClassifierService()
        result = svc.classify("There's no reason for me to keep going.")
        assert result.classification == SafetyClassification.CRISIS


class TestClassificationResult:
    """ClassificationResult carries metadata for audit trail."""

    def test_result_has_classification(self):
        svc = SafetyClassifierService()
        result = svc.classify("Hello, how are you?")
        assert isinstance(result, ClassificationResult)
        assert isinstance(result.classification, SafetyClassification)

    def test_result_has_matched_patterns(self):
        svc = SafetyClassifierService()
        result = svc.classify("You should take ibuprofen for the pain.")
        assert isinstance(result.matched_patterns, list)
        assert len(result.matched_patterns) > 0

    def test_result_has_layer(self):
        """Layer indicates keyword or llm classification."""
        svc = SafetyClassifierService()
        result = svc.classify("You should take ibuprofen for the pain.")
        assert result.layer in ("keyword", "llm")

    def test_safe_result_has_empty_patterns(self):
        svc = SafetyClassifierService()
        result = svc.classify("Keep up the good work!")
        assert result.matched_patterns == []

    def test_result_has_message(self):
        """Original message stored for audit logging."""
        svc = SafetyClassifierService()
        msg = "You should take ibuprofen."
        result = svc.classify(msg)
        assert result.message == msg


class TestPriorityAndEdgeCases:
    """Crisis takes priority over clinical; case insensitivity; edge cases."""

    def test_crisis_priority_over_clinical(self):
        """If both crisis and clinical patterns match, crisis wins."""
        svc = SafetyClassifierService()
        result = svc.classify(
            "I want to hurt myself and I think I need medication."
        )
        assert result.classification == SafetyClassification.CRISIS

    def test_case_insensitive_crisis(self):
        svc = SafetyClassifierService()
        result = svc.classify("I WANT TO HURT MYSELF")
        assert result.classification == SafetyClassification.CRISIS

    def test_case_insensitive_clinical(self):
        svc = SafetyClassifierService()
        result = svc.classify("YOU SHOULD TAKE IBUPROFEN")
        assert result.classification == SafetyClassification.CLINICAL_CONTENT

    def test_exercise_advice_not_clinical(self):
        """Exercise guidance should NOT trigger clinical flag."""
        svc = SafetyClassifierService()
        result = svc.classify(
            "Try doing 10 reps of the leg raise exercise we discussed."
        )
        assert result.classification == SafetyClassification.SAFE
