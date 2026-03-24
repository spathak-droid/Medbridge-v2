"""Dropout risk scoring service — clinician-facing.

Predicts patient disengagement using a weighted additive model (0-100 scale).
Pure scoring function + async DB assessment for testability.

Signals:
- Days since last exercise (30pts)
- Adherence trend (25pts)
- Unanswered messages (20pts)
- Days since last conversation (15pts)
- Patient phase (10pts)

Thresholds: 0-25=LOW, 26-50=MEDIUM, 51-75=HIGH, 76-100=CRITICAL
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PatientPhase, RiskLevel


@dataclass
class RiskAssessment:
    risk_level: RiskLevel
    risk_score: int
    risk_factors: list[str]
    patient_id: int
    assessed_at: datetime


# ---------------------------------------------------------------------------
# Pure scoring function — fully testable without DB
# ---------------------------------------------------------------------------


def calculate_risk_score(
    *,
    days_since_last_exercise: int | None = None,
    adherence_pct: float | None = None,
    adherence_trend: str | None = None,
    unanswered_messages: int = 0,
    days_since_last_conversation: int | None = None,
    phase: str | None = None,
) -> RiskAssessment:
    """Calculate dropout risk score from patient signals.

    All inputs are optional/defaulted so callers can supply whatever data
    they have. Returns a RiskAssessment with a dummy patient_id=0 —
    callers should set the real patient_id.
    """
    score = 0
    factors: list[str] = []

    # --- Days since last exercise (max 30pts) ---
    if days_since_last_exercise is None:
        pts = 15  # unknown = moderate concern
        factors.append("No exercise data available")
    elif days_since_last_exercise == 0:
        pts = 0
    elif days_since_last_exercise <= 2:
        pts = 5
    elif days_since_last_exercise <= 5:
        pts = 15
        factors.append(f"No exercise in {days_since_last_exercise} days")
    elif days_since_last_exercise <= 10:
        pts = 25
        factors.append(f"No exercise in {days_since_last_exercise} days")
    else:
        pts = 30
        factors.append(f"No exercise in {days_since_last_exercise} days")
    score += pts

    # --- Adherence trend (max 25pts) ---
    trend_upper = (adherence_trend or "").upper()
    if adherence_pct is not None and adherence_pct >= 80:
        pts = 0
    elif trend_upper == "HIGH":
        pts = 0
    elif adherence_pct is not None and adherence_pct >= 60:
        pts = 8
    elif trend_upper == "MODERATE":
        pts = 8
    elif trend_upper in ("NEW", ""):
        pts = 15
        if adherence_pct is not None and adherence_pct < 60:
            factors.append(f"Low adherence ({adherence_pct:.0f}%)")
    elif adherence_pct is not None and adherence_pct >= 40:
        pts = 15
    elif trend_upper == "DECLINING":
        pts = 25
        factors.append("Declining adherence trend")
    elif adherence_pct is not None and adherence_pct < 40:
        pts = 25
        factors.append(f"Very low adherence ({adherence_pct:.0f}%)")
    else:
        pts = 15  # unknown
    score += pts

    # --- Unanswered messages (max 20pts) ---
    if unanswered_messages == 0:
        pts = 0
    elif unanswered_messages == 1:
        pts = 7
    elif unanswered_messages == 2:
        pts = 14
        factors.append(f"{unanswered_messages} unanswered messages")
    else:
        pts = 20
        factors.append(f"{unanswered_messages} unanswered messages")
    score += pts

    # --- Days since last conversation (max 15pts) ---
    if days_since_last_conversation is None:
        pts = 10  # unknown = moderate concern
    elif days_since_last_conversation <= 1:
        pts = 0
    elif days_since_last_conversation <= 3:
        pts = 5
    elif days_since_last_conversation <= 7:
        pts = 10
        factors.append(f"No conversation in {days_since_last_conversation} days")
    else:
        pts = 15
        factors.append(f"No conversation in {days_since_last_conversation} days")
    score += pts

    # --- Phase (max 10pts) ---
    phase_upper = (phase or "").upper()
    if phase_upper == "ACTIVE":
        pts = 0
    elif phase_upper == "ONBOARDING":
        pts = 2
    elif phase_upper == "RE_ENGAGING":
        pts = 5
        factors.append("Patient is re-engaging after absence")
    elif phase_upper == "DORMANT":
        pts = 10
        factors.append("Patient is dormant")
    else:
        pts = 2  # PENDING or unknown
    score += pts

    # Clamp
    score = max(0, min(100, score))

    # Threshold
    if score <= 25:
        level = RiskLevel.LOW
    elif score <= 50:
        level = RiskLevel.MEDIUM
    elif score <= 75:
        level = RiskLevel.HIGH
    else:
        level = RiskLevel.CRITICAL

    return RiskAssessment(
        risk_level=level,
        risk_score=score,
        risk_factors=factors,
        patient_id=0,
        assessed_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Async DB assessment
# ---------------------------------------------------------------------------


async def assess_patient_risk(
    session: AsyncSession,
    patient_id: int,
) -> RiskAssessment:
    """Assess dropout risk for a single patient using DB data."""
    from app.data.adherence import compute_adherence, get_adherence_for_patient
    from app.models.conversation import Conversation
    from app.models.message import Message
    from app.models.patient import Patient

    result = await session.execute(
        select(Patient).where(Patient.id == patient_id)
    )
    patient = result.scalar_one_or_none()
    if patient is None:
        raise ValueError(f"Patient {patient_id} not found")

    # Adherence data — use hardcoded data for demo patients, real DB for others
    adh = get_adherence_for_patient(patient.external_id, patient.program_type)
    if adh is None or (not patient.external_id.startswith("PT-") and patient.program_type):
        real_adh = await compute_adherence(session, patient_id, patient.external_id, patient.program_type)
        if real_adh is not None:
            adh = real_adh
    adherence_pct = adh.get("adherence_percentage") if adh else None
    adherence_trend = adh.get("status") if adh else None
    current_streak = adh.get("current_streak", 0) if adh else 0
    last_completed = adh.get("last_completed") if adh else None

    # Days since last exercise
    days_since_exercise: int | None = None
    if last_completed:
        try:
            last_date = datetime.strptime(last_completed, "%Y-%m-%d").date()
            days_since_exercise = (datetime.now(timezone.utc).date() - last_date).days
        except (ValueError, TypeError):
            pass

    # Days since last conversation
    conv_result = await session.execute(
        select(Conversation)
        .where(Conversation.patient_id == patient_id)
        .order_by(Conversation.started_at.desc())
        .limit(1)
    )
    conv = conv_result.scalar_one_or_none()
    days_since_conv: int | None = None
    if conv:
        # Get last message time
        msg_result = await session.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()
        if last_msg:
            msg_time = last_msg.created_at
            if msg_time.tzinfo is None:
                from datetime import timezone as tz
                msg_time = msg_time.replace(tzinfo=tz.utc)
            days_since_conv = (datetime.now(timezone.utc) - msg_time).days

    assessment = calculate_risk_score(
        days_since_last_exercise=days_since_exercise,
        adherence_pct=adherence_pct,
        adherence_trend=adherence_trend,
        unanswered_messages=patient.unanswered_count,
        days_since_last_conversation=days_since_conv,
        phase=patient.phase.value,
    )
    assessment.patient_id = patient_id
    return assessment


async def assess_all_patients_risk(
    session: AsyncSession,
) -> list[RiskAssessment]:
    """Assess dropout risk for all non-PENDING patients, sorted by score descending."""
    from app.models.patient import Patient

    result = await session.execute(
        select(Patient).where(
            Patient.phase != PatientPhase.PENDING,
        )
    )
    patients = result.scalars().all()

    assessments: list[RiskAssessment] = []
    for patient in patients:
        try:
            assessment = await assess_patient_risk(session, patient.id)
            assessments.append(assessment)
        except Exception:
            continue

    assessments.sort(key=lambda a: a.risk_score, reverse=True)
    return assessments
