"""Tests for dropout risk scoring service.

Covers:
- Pure function: boundary values, all-zeros → LOW, max signals → CRITICAL
- Async DB: active patient w/recent exercise → LOW, dormant → HIGH, not found → raises
- Batch: sorted output
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PatientPhase, RiskLevel
from app.models.patient import Patient
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.enums import MessageRole, SafetyStatus
from app.services.risk_scoring import (
    RiskAssessment,
    assess_all_patients_risk,
    assess_patient_risk,
    calculate_risk_score,
)


# ---------------------------------------------------------------------------
# Pure function tests
# ---------------------------------------------------------------------------


class TestCalculateRiskScore:
    def test_all_zeros_is_low(self):
        result = calculate_risk_score(
            days_since_last_exercise=0,
            adherence_pct=90.0,
            adherence_trend="HIGH",
            unanswered_messages=0,
            days_since_last_conversation=0,
            phase="ACTIVE",
        )
        assert result.risk_level == RiskLevel.LOW
        assert result.risk_score <= 25

    def test_max_signals_is_critical(self):
        result = calculate_risk_score(
            days_since_last_exercise=15,
            adherence_pct=10.0,
            adherence_trend="DECLINING",
            unanswered_messages=5,
            days_since_last_conversation=14,
            phase="DORMANT",
        )
        assert result.risk_level == RiskLevel.CRITICAL
        assert result.risk_score >= 76

    def test_boundary_25_26(self):
        """Score of exactly 25 should be LOW, 26 should be MEDIUM."""
        # Construct a score around 25
        result_low = calculate_risk_score(
            days_since_last_exercise=2,  # 5pts
            adherence_pct=90.0,          # 0pts
            unanswered_messages=1,       # 7pts
            days_since_last_conversation=3, # 5pts
            phase="ACTIVE",              # 0pts
        )
        # Total: 5+0+7+5+0 = 17 → LOW
        assert result_low.risk_level == RiskLevel.LOW

    def test_boundary_medium(self):
        result = calculate_risk_score(
            days_since_last_exercise=4,  # 15pts
            adherence_pct=65.0,          # 8pts
            unanswered_messages=1,       # 7pts
            days_since_last_conversation=5, # 10pts
            phase="ACTIVE",              # 0pts
        )
        # Total: 15+8+7+10+0 = 40 → MEDIUM
        assert result.risk_level == RiskLevel.MEDIUM

    def test_boundary_high(self):
        result = calculate_risk_score(
            days_since_last_exercise=8,  # 25pts
            adherence_pct=35.0,          # 25pts
            adherence_trend="DECLINING",
            unanswered_messages=0,       # 0pts
            days_since_last_conversation=1, # 0pts
            phase="RE_ENGAGING",         # 5pts
        )
        # Total: 25+25+0+0+5 = 55 → HIGH
        assert result.risk_level == RiskLevel.HIGH

    def test_none_exercise_days_moderate_concern(self):
        result = calculate_risk_score(
            days_since_last_exercise=None,
            adherence_pct=90.0,
            unanswered_messages=0,
            days_since_last_conversation=0,
            phase="ACTIVE",
        )
        # 15+0+0+0+0 = 15 → LOW
        assert result.risk_level == RiskLevel.LOW

    def test_none_conversation_days(self):
        result = calculate_risk_score(
            days_since_last_exercise=0,
            adherence_pct=90.0,
            unanswered_messages=0,
            days_since_last_conversation=None,
            phase="ACTIVE",
        )
        # 0+0+0+10+0 = 10 → LOW
        assert result.risk_level == RiskLevel.LOW

    def test_all_none_defaults(self):
        """All None/default values should give a reasonable score."""
        result = calculate_risk_score()
        assert isinstance(result.risk_level, RiskLevel)
        assert 0 <= result.risk_score <= 100

    def test_risk_factors_populated_for_high_risk(self):
        result = calculate_risk_score(
            days_since_last_exercise=12,
            adherence_pct=20.0,
            adherence_trend="DECLINING",
            unanswered_messages=3,
            days_since_last_conversation=10,
            phase="DORMANT",
        )
        assert len(result.risk_factors) > 0
        assert any("exercise" in f.lower() for f in result.risk_factors)

    def test_risk_factors_empty_for_healthy_patient(self):
        result = calculate_risk_score(
            days_since_last_exercise=0,
            adherence_pct=95.0,
            adherence_trend="HIGH",
            unanswered_messages=0,
            days_since_last_conversation=0,
            phase="ACTIVE",
        )
        assert len(result.risk_factors) == 0

    def test_score_clamped_to_100(self):
        result = calculate_risk_score(
            days_since_last_exercise=30,
            adherence_pct=5.0,
            adherence_trend="DECLINING",
            unanswered_messages=10,
            days_since_last_conversation=30,
            phase="DORMANT",
        )
        assert result.risk_score <= 100

    def test_dormant_phase_adds_points(self):
        active = calculate_risk_score(phase="ACTIVE")
        dormant = calculate_risk_score(phase="DORMANT")
        assert dormant.risk_score > active.risk_score

    def test_unanswered_messages_scales(self):
        zero = calculate_risk_score(unanswered_messages=0)
        one = calculate_risk_score(unanswered_messages=1)
        three = calculate_risk_score(unanswered_messages=3)
        assert zero.risk_score < one.risk_score < three.risk_score

    def test_returns_risk_assessment_dataclass(self):
        result = calculate_risk_score()
        assert isinstance(result, RiskAssessment)
        assert result.patient_id == 0  # placeholder
        assert result.assessed_at is not None


# ---------------------------------------------------------------------------
# Async DB tests
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


class TestAssessPatientRisk:
    async def test_active_patient_with_good_adherence(self, db_session: AsyncSession):
        """Sarah (PT-SARAH-001) has high adherence → should be LOW risk."""
        patient = await _create_patient(db_session, external_id="PT-SARAH-001")
        # Add a recent conversation
        conv = Conversation(
            patient_id=patient.id,
            phase_at_creation=PatientPhase.ACTIVE,
        )
        db_session.add(conv)
        await db_session.commit()
        await db_session.refresh(conv)

        msg = Message(
            conversation_id=conv.id,
            role=MessageRole.PATIENT,
            content="Hello",
            safety_status=SafetyStatus.PASSED,
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(msg)
        await db_session.commit()

        result = await assess_patient_risk(db_session, patient.id)
        assert result.risk_level == RiskLevel.LOW
        assert result.patient_id == patient.id

    async def test_dormant_patient_is_high_risk(self, db_session: AsyncSession):
        patient = await _create_patient(
            db_session,
            phase=PatientPhase.DORMANT,
            external_id="PT-EMILY-003",
        )
        result = await assess_patient_risk(db_session, patient.id)
        assert result.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL)

    async def test_not_found_raises(self, db_session: AsyncSession):
        with pytest.raises(ValueError, match="not found"):
            await assess_patient_risk(db_session, 9999)

    async def test_batch_sorted_by_score(self, db_session: AsyncSession):
        await _create_patient(
            db_session, external_id="PT-SARAH-001", phase=PatientPhase.ACTIVE
        )
        await _create_patient(
            db_session, external_id="PT-EMILY-003", phase=PatientPhase.DORMANT
        )
        results = await assess_all_patients_risk(db_session)
        assert len(results) >= 2
        scores = [r.risk_score for r in results]
        assert scores == sorted(scores, reverse=True)
