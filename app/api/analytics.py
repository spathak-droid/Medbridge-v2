"""Analytics endpoints for clinician dashboard."""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import AuthenticatedUser, require_clinician
from app.data.adherence import compute_adherence, get_adherence_for_patient
from app.models.alert import Alert
from app.models.conversation import Conversation
from app.models.enums import AlertStatus, PatientPhase
from app.models.exercise_log import ExerciseLog
from app.models.goal import Goal
from app.models.message import Message
from app.models.patient import Patient
from app.services.risk_scoring import assess_all_patients_risk


def display_name(name: str) -> str:
    """Never show raw emails as patient names."""
    if '@' in name:
        return name.split('@')[0]
    return name


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class ActivityFeedItem(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    event_type: str
    description: str
    timestamp: str


class AnalyticsSummaryResponse(BaseModel):
    total_patients: int
    phase_distribution: dict[str, int]
    avg_adherence: float
    active_alerts: int
    activity_feed: list[ActivityFeedItem]


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> AnalyticsSummaryResponse:
    """Return aggregate analytics for the clinician dashboard."""
    # Total patients
    result = await session.execute(select(func.count(Patient.id)))
    total_patients = result.scalar() or 0

    # Phase distribution
    phase_result = await session.execute(
        select(Patient.phase, func.count(Patient.id)).group_by(Patient.phase)
    )
    phase_distribution = {row[0].value: row[1] for row in phase_result.all()}

    # Average adherence across patients with data
    patients_result = await session.execute(select(Patient))
    patients = patients_result.scalars().all()
    adherence_values = []
    for p in patients:
        adh = get_adherence_for_patient(p.external_id, p.program_type)
        if adh and isinstance(adh, dict):
            adherence_values.append(adh["adherence_percentage"])
    avg_adherence = round(sum(adherence_values) / len(adherence_values), 1) if adherence_values else 0.0

    # Active (unacknowledged) alerts
    alert_result = await session.execute(
        select(func.count(Alert.id)).where(Alert.status == AlertStatus.NEW)
    )
    active_alerts = alert_result.scalar() or 0

    # Recent activity feed — last 20 messages across all conversations
    msg_result = await session.execute(
        select(Message, Conversation.patient_id)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    rows = msg_result.all()

    # Build patient name lookup
    patient_map = {p.id: p for p in patients}

    feed: list[ActivityFeedItem] = []
    for msg, p_id in rows:
        patient = patient_map.get(p_id)
        name = patient.name if patient else f"Patient {p_id}"
        event_type = "coach_message" if msg.role.value == "COACH" else "patient_message"
        desc = msg.content[:100] + ("..." if len(msg.content) > 100 else "")
        feed.append(ActivityFeedItem(
            id=msg.id,
            patient_id=p_id,
            patient_name=display_name(name),
            event_type=event_type,
            description=desc,
            timestamp=msg.created_at.isoformat() if msg.created_at else datetime.now(timezone.utc).isoformat(),
        ))

    return AnalyticsSummaryResponse(
        total_patients=total_patients,
        phase_distribution=phase_distribution,
        avg_adherence=avg_adherence,
        active_alerts=active_alerts,
        activity_feed=feed[:10],
    )


# ---------------------------------------------------------------------------
# V2 Analytics — decision-support dashboard
# ---------------------------------------------------------------------------


class AttentionPatient(BaseModel):
    patient_id: int
    name: str
    risk_level: str
    risk_score: int
    top_risk_factor: str
    adherence_pct: float | None
    adherence_trend: str  # "improving" | "declining" | "stable"


class HeatmapCell(BaseModel):
    date: str
    completed: bool


class HeatmapRow(BaseModel):
    patient_id: int
    name: str
    cells: list[HeatmapCell]


class DailyRate(BaseModel):
    date: str
    rate: float  # 0-100


class ProgramStat(BaseModel):
    program_type: str
    program_name: str
    avg_adherence: float
    patient_count: int


class ProgramOutlier(BaseModel):
    patient_id: int
    name: str
    program_type: str
    adherence_pct: float
    program_avg: float


class SilentPatient(BaseModel):
    patient_id: int
    name: str
    days_silent: int
    last_message_at: str | None


class UnansweredPatient(BaseModel):
    patient_id: int
    name: str
    unanswered_count: int


class MilestoneEvent(BaseModel):
    event_type: str  # "goal_confirmed" | "phase_change" | "alert_generated"
    patient_id: int
    patient_name: str
    description: str
    timestamp: str


class AnalyticsV2Response(BaseModel):
    attention: list[AttentionPatient]
    heatmap: list[HeatmapRow]
    heatmap_dates: list[str]
    daily_rates: list[DailyRate]
    programs: list[ProgramStat]
    outliers: list[ProgramOutlier]
    silent_patients: list[SilentPatient]
    unanswered_patients: list[UnansweredPatient]
    milestones: list[MilestoneEvent]


@router.get("/v2", response_model=AnalyticsV2Response)
async def get_analytics_v2(
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> AnalyticsV2Response:
    """Return V2 analytics with 4 decision-support sections."""
    now = datetime.now(timezone.utc)
    today = date.today()
    fourteen_days_ago = today - timedelta(days=13)
    date_range = [today - timedelta(days=i) for i in range(13, -1, -1)]
    heatmap_dates = [d.isoformat() for d in date_range]

    # 1. Load all patients (exclude PENDING with no program)
    result = await session.execute(select(Patient))
    all_patients = result.scalars().all()
    patients = [
        p for p in all_patients
        if not (p.phase == PatientPhase.PENDING and not p.program_type)
    ]
    patient_map = {p.id: p for p in patients}

    # 2. Risk scores → attention list
    risk_assessments = await assess_all_patients_risk(session)
    risk_map = {a.patient_id: a for a in risk_assessments}

    # 3. Adherence data for all patients
    adherence_map: dict[int, dict | None] = {}
    for p in patients:
        adh = get_adherence_for_patient(p.external_id, p.program_type)
        if adh is None or (p.external_id and not p.external_id.startswith("PT-") and p.program_type):
            real_adh = await compute_adherence(session, p.id, p.external_id, p.program_type)
            if real_adh is not None:
                adh = real_adh
        adherence_map[p.id] = adh

    # 4. Compute adherence trend: last 7 days vs prior 7 days
    def compute_trend(patient_id: int) -> str:
        logs_result_data = exercise_logs_by_patient.get(patient_id, {})
        recent_7 = sum(1 for d in date_range[7:] if d in logs_result_data)
        prior_7 = sum(1 for d in date_range[:7] if d in logs_result_data)
        if recent_7 > prior_7:
            return "improving"
        elif recent_7 < prior_7:
            return "declining"
        return "stable"

    # 5. Bulk query exercise_logs last 14 days
    logs_result = await session.execute(
        select(ExerciseLog.patient_id, ExerciseLog.completed_date).where(
            ExerciseLog.completed_date >= fourteen_days_ago,
            ExerciseLog.completed_date <= today,
        )
    )
    all_logs = logs_result.all()

    exercise_logs_by_patient: dict[int, dict[date, bool]] = {}
    for pid, comp_date in all_logs:
        if pid not in exercise_logs_by_patient:
            exercise_logs_by_patient[pid] = {}
        exercise_logs_by_patient[pid][comp_date] = True

    # Also incorporate demo daily_log data into exercise_logs_by_patient
    for p in patients:
        adh = adherence_map.get(p.id)
        if adh and adh.get("daily_log"):
            if p.id not in exercise_logs_by_patient:
                exercise_logs_by_patient[p.id] = {}
            for entry in adh["daily_log"]:
                if entry.get("completed"):
                    d = date.fromisoformat(entry["date"])
                    if fourteen_days_ago <= d <= today:
                        exercise_logs_by_patient[p.id][d] = True
        # For demo patients with last_completed, seed some data
        if adh and p.external_id and p.external_id.startswith("PT-") and p.id not in exercise_logs_by_patient:
            exercise_logs_by_patient[p.id] = {}
            last_comp = adh.get("last_completed")
            if last_comp:
                streak = adh.get("current_streak", 0)
                pct = adh.get("adherence_percentage", 0)
                last_d = date.fromisoformat(last_comp)
                # Simulate based on adherence percentage
                for d in date_range:
                    if d <= last_d:
                        # Use adherence_percentage to probabilistically fill
                        day_offset = (last_d - d).days
                        if day_offset < streak or (pct > 50 and d.toordinal() % 3 != 0):
                            exercise_logs_by_patient[p.id][d] = True

    # --- Section 1: Attention list ---
    attention: list[AttentionPatient] = []
    for assessment in risk_assessments:
        if assessment.risk_score <= 25:
            continue
        p = patient_map.get(assessment.patient_id)
        if not p:
            continue
        adh = adherence_map.get(p.id)
        adh_pct = adh.get("adherence_percentage") if adh else None
        trend = compute_trend(p.id)
        top_factor = assessment.risk_factors[0] if assessment.risk_factors else "Elevated risk"
        attention.append(AttentionPatient(
            patient_id=p.id,
            name=display_name(p.name),
            risk_level=assessment.risk_level.value,
            risk_score=assessment.risk_score,
            top_risk_factor=top_factor,
            adherence_pct=adh_pct,
            adherence_trend=trend,
        ))

    # --- Section 2: Heatmap ---
    heatmap: list[HeatmapRow] = []
    patients_with_program = [p for p in patients if p.program_type]
    daily_completion_counts: dict[date, int] = {d: 0 for d in date_range}
    daily_patient_counts: dict[date, int] = {d: 0 for d in date_range}

    for p in patients_with_program:
        plogs = exercise_logs_by_patient.get(p.id, {})
        cells: list[HeatmapCell] = []
        for d in date_range:
            completed = d in plogs
            cells.append(HeatmapCell(date=d.isoformat(), completed=completed))
            daily_patient_counts[d] += 1
            if completed:
                daily_completion_counts[d] += 1
        heatmap.append(HeatmapRow(patient_id=p.id, name=display_name(p.name), cells=cells))

    daily_rates: list[DailyRate] = []
    for d in date_range:
        total = daily_patient_counts[d]
        rate = round((daily_completion_counts[d] / total) * 100, 1) if total > 0 else 0.0
        daily_rates.append(DailyRate(date=d.isoformat(), rate=rate))

    # --- Section 3: Program effectiveness ---
    program_groups: dict[str, list[float]] = {}
    program_patient_adh: dict[str, list[tuple[int, str, float]]] = {}
    for p in patients:
        if not p.program_type:
            continue
        adh = adherence_map.get(p.id)
        if not adh:
            continue
        pct = adh.get("adherence_percentage", 0.0)
        if p.program_type not in program_groups:
            program_groups[p.program_type] = []
            program_patient_adh[p.program_type] = []
        program_groups[p.program_type].append(pct)
        program_patient_adh[p.program_type].append((p.id, p.name, pct))

    # Program name mapping
    from app.data.programs import PROGRAMS
    program_name_map = {pt: prog["program_name"] for pt, prog in PROGRAMS.items()}

    programs: list[ProgramStat] = []
    for pt, values in program_groups.items():
        avg = round(sum(values) / len(values), 1) if values else 0.0
        programs.append(ProgramStat(
            program_type=pt,
            program_name=program_name_map.get(pt, pt.replace("_", " ").title()),
            avg_adherence=avg,
            patient_count=len(values),
        ))
    programs.sort(key=lambda x: x.avg_adherence)

    # Outliers: patients >15pts below their program's average
    program_avg_map = {ps.program_type: ps.avg_adherence for ps in programs}
    outliers: list[ProgramOutlier] = []
    for pt, entries in program_patient_adh.items():
        avg = program_avg_map.get(pt, 0.0)
        for pid, name, pct in entries:
            if avg - pct > 15:
                outliers.append(ProgramOutlier(
                    patient_id=pid,
                    name=name,
                    program_type=pt,
                    adherence_pct=pct,
                    program_avg=avg,
                ))

    # --- Section 4: Engagement signals ---

    # Silent patients: no conversation message in 3+ days
    # Get last message time per patient
    from sqlalchemy.orm import aliased
    msg_alias = aliased(Message)
    last_msg_result = await session.execute(
        select(
            Conversation.patient_id,
            func.max(Message.created_at).label("last_msg_at"),
        )
        .join(Message, Message.conversation_id == Conversation.id)
        .group_by(Conversation.patient_id)
    )
    last_msg_map: dict[int, datetime] = {}
    for pid, last_at in last_msg_result.all():
        if last_at:
            last_msg_map[pid] = last_at if last_at.tzinfo else last_at.replace(tzinfo=timezone.utc)

    silent_patients: list[SilentPatient] = []
    for p in patients:
        last_at = last_msg_map.get(p.id)
        if last_at:
            days_silent = (now - last_at).days
            if days_silent >= 3:
                silent_patients.append(SilentPatient(
                    patient_id=p.id,
                    name=display_name(p.name),
                    days_silent=days_silent,
                    last_message_at=last_at.isoformat(),
                ))
        else:
            # No messages at all — consider silent
            silent_patients.append(SilentPatient(
                patient_id=p.id,
                name=display_name(p.name),
                days_silent=999,
                last_message_at=None,
            ))
    silent_patients.sort(key=lambda x: x.days_silent, reverse=True)

    # Unanswered patients
    unanswered_patients: list[UnansweredPatient] = [
        UnansweredPatient(
            patient_id=p.id,
            name=display_name(p.name),
            unanswered_count=p.unanswered_count,
        )
        for p in patients
        if p.unanswered_count > 0
    ]
    unanswered_patients.sort(key=lambda x: x.unanswered_count, reverse=True)

    # Milestones: recent goals (confirmed), alerts, phase changes
    milestones: list[MilestoneEvent] = []

    # Confirmed goals
    goals_result = await session.execute(
        select(Goal)
        .where(Goal.confirmed.is_(True))
        .order_by(Goal.created_at.desc())
        .limit(10)
    )
    for g in goals_result.scalars().all():
        p = patient_map.get(g.patient_id)
        if p:
            milestones.append(MilestoneEvent(
                event_type="goal_confirmed",
                patient_id=p.id,
                patient_name=display_name(p.name),
                description=f"Goal confirmed: {g.raw_text[:80]}",
                timestamp=g.created_at.isoformat() if g.created_at else now.isoformat(),
            ))

    # Recent alerts
    alerts_result = await session.execute(
        select(Alert)
        .order_by(Alert.created_at.desc())
        .limit(10)
    )
    for a in alerts_result.scalars().all():
        p = patient_map.get(a.patient_id)
        if p:
            milestones.append(MilestoneEvent(
                event_type="alert_generated",
                patient_id=p.id,
                patient_name=display_name(p.name),
                description=f"Alert: {a.reason[:80]}",
                timestamp=a.created_at.isoformat() if a.created_at else now.isoformat(),
            ))

    # Phase changes (patients with recent phase_updated_at)
    for p in patients:
        if p.phase_updated_at:
            phase_time = p.phase_updated_at
            if phase_time.tzinfo is None:
                phase_time = phase_time.replace(tzinfo=timezone.utc)
            if (now - phase_time).days <= 14:
                milestones.append(MilestoneEvent(
                    event_type="phase_change",
                    patient_id=p.id,
                    patient_name=display_name(p.name),
                    description=f"Phase changed to {p.phase.value}",
                    timestamp=phase_time.isoformat(),
                ))

    # Positive milestones: streak and adherence achievements
    for p in patients:
        adh = adherence_map.get(p.id)
        if not adh:
            continue

        # Streak milestones: 7, 14, or 30-day streaks
        streak = adh.get("current_streak", 0)
        for threshold in (30, 14, 7):
            if streak >= threshold:
                milestones.append(MilestoneEvent(
                    event_type="streak_milestone",
                    patient_id=p.id,
                    patient_name=display_name(p.name),
                    description=f"{threshold}-day exercise streak!",
                    timestamp=now.isoformat(),
                ))
                break  # Only report highest streak milestone

        # Adherence milestone: crossed 80%
        adh_pct = adh.get("adherence_percentage", 0)
        if adh_pct >= 80:
            milestones.append(MilestoneEvent(
                event_type="adherence_milestone",
                patient_id=p.id,
                patient_name=display_name(p.name),
                description=f"Adherence at {adh_pct}% — above 80% target",
                timestamp=now.isoformat(),
            ))

    # Sort milestones by timestamp desc, take last 10 (more room for positive milestones)
    milestones.sort(key=lambda x: x.timestamp, reverse=True)
    milestones = milestones[:10]

    return AnalyticsV2Response(
        attention=attention,
        heatmap=heatmap,
        heatmap_dates=heatmap_dates,
        daily_rates=daily_rates,
        programs=programs,
        outliers=outliers,
        silent_patients=silent_patients,
        unanswered_patients=unanswered_patients,
        milestones=milestones,
    )
