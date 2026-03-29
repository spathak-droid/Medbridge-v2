"""Patient endpoints — TICKET-003, TICKET-015."""

from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.dependencies import require_own_patient_data, set_audit_user
from app.data.adherence import compute_adherence, get_adherence_for_patient
from app.data.programs import PROGRAMS, get_program_for_patient
from app.middleware.auth import AuthenticatedUser, require_clinician
from app.models.clinical_note import ClinicalNote
from app.models.conversation import Conversation
from app.models.enums import PatientPhase, ScheduleStatus
from app.models.exercise_log import ExerciseLog
from app.models.exercise_rating import ExerciseRating
from app.models.video_watch_log import VideoWatchLog
from app.models.goal import Goal
from app.models.patient_insight import PatientInsight
from app.models.message import Message
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent


def display_name(name: str) -> str:
    """Never show raw emails as patient names."""
    if '@' in name:
        return name.split('@')[0]
    return name


router = APIRouter(prefix="/api/patients", tags=["patients"])


class PatientListItem(BaseModel):
    id: int
    name: str
    external_id: str
    phase: str
    consent_given: bool
    adherence_pct: float | None = None
    goal_summary: str | None = None


class CreatePatientRequest(BaseModel):
    name: str
    email: str
    program_type: str


class CreatePatientResponse(BaseModel):
    id: int
    name: str
    email: str
    program_type: str
    phase: str
    consent_given: bool


@router.post("/create", response_model=CreatePatientResponse)
async def create_patient(
    body: CreatePatientRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> CreatePatientResponse:
    """Clinician creates a patient record with an assigned exercise program."""
    if body.program_type not in PROGRAMS:
        available = ", ".join(PROGRAMS.keys())
        raise HTTPException(status_code=400, detail=f"Invalid program type. Available: {available}")

    existing = await session.execute(
        select(Patient).where(Patient.email == body.email)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="A patient with this email already exists")

    patient = Patient(
        name=body.name,
        email=body.email,
        program_type=body.program_type,
        logged_in=False,
        consent_given=False,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)

    return CreatePatientResponse(
        id=patient.id,
        name=patient.name,
        email=patient.email or "",
        program_type=patient.program_type or "",
        phase=patient.phase.value,
        consent_given=patient.consent_given,
    )


@router.get("", response_model=list[PatientListItem])
async def list_patients(
    real_only: bool = False,
    exclude_uid: str | None = None,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> list[PatientListItem]:
    """List all patients with summary data. Use real_only=true to exclude demo/seeded patients."""
    query = select(Patient).order_by(Patient.id)
    if real_only:
        query = query.where(
            (Patient.external_id.is_(None)) | (~Patient.external_id.startswith("PT-"))
        )
    if exclude_uid:
        query = query.where(
            (Patient.external_id.is_(None)) | (Patient.external_id != exclude_uid)
        )
    result = await session.execute(query)
    patients = result.scalars().all()
    items = []
    for p in patients:
        # Adherence — use real computation from exercise_logs
        real_adh = await compute_adherence(session, p.id, p.external_id or "", p.program_type)
        if real_adh:
            adh_pct = real_adh["adherence_percentage"]
        else:
            adh = get_adherence_for_patient(p.external_id or "", p.program_type)
            adh_pct = adh["adherence_percentage"] if adh and isinstance(adh, dict) else None

        # Latest confirmed goal
        goal_result = await session.execute(
            select(Goal)
            .where(Goal.patient_id == p.id, Goal.confirmed == True)  # noqa: E712
            .order_by(Goal.created_at.desc())
        )
        goal = goal_result.scalars().first()

        items.append(PatientListItem(
            id=p.id,
            name=display_name(p.name),
            external_id=p.external_id or "",
            phase=p.phase.value,
            consent_given=p.consent_given,
            adherence_pct=adh_pct,
            goal_summary=goal.raw_text if goal else None,
        ))
    return items


class ProgramResponse(BaseModel):
    program_name: str
    program_type: str
    duration_weeks: int
    start_date: str
    exercises: list[dict[str, Any]]


@router.get("/{patient_id}/program", response_model=ProgramResponse | None)
async def get_program(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> Any:
    """Return exercise program for a patient."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    program = get_program_for_patient(patient.external_id, patient.program_type)
    if program is None:
        return None
    return program


# ---------------------------------------------------------------------------
# Program management endpoints
# ---------------------------------------------------------------------------


class AvailableProgramItem(BaseModel):
    program_type: str
    program_name: str
    duration_weeks: int
    exercise_count: int


@router.get("/programs/available", response_model=list[AvailableProgramItem])
async def list_available_programs(
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> list[AvailableProgramItem]:
    """List all available exercise programs."""
    return [
        AvailableProgramItem(
            program_type=key,
            program_name=prog["program_name"],
            duration_weeks=prog["duration_weeks"],
            exercise_count=len(prog["exercises"]),
        )
        for key, prog in PROGRAMS.items()
    ]


@router.get("/programs/library")
async def get_programs_library(
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> list[dict]:
    """Return all programs with full exercise details for the exercise library."""
    return [
        {
            "program_type": key,
            "program_name": prog["program_name"],
            "duration_weeks": prog["duration_weeks"],
            "exercises": prog["exercises"],
        }
        for key, prog in PROGRAMS.items()
    ]


class AssignProgramRequest(BaseModel):
    program_type: str


@router.post("/{patient_id}/program", response_model=ProgramResponse)
async def assign_program(
    patient_id: int,
    body: AssignProgramRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> Any:
    """Assign or switch an exercise program for a patient."""
    if body.program_type not in PROGRAMS:
        available = ", ".join(PROGRAMS.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Unknown program type '{body.program_type}'. Available: {available}",
        )

    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient.program_type = body.program_type
    session.add(patient)
    await session.commit()
    await session.refresh(patient)

    return PROGRAMS[body.program_type]


@router.delete("/{patient_id}/program")
async def clear_program(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> dict:
    """Clear/remove the current exercise program from a patient."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient.program_type = None
    session.add(patient)
    await session.commit()

    return {"cleared": True, "patient_id": patient_id}


class AdherenceResponse(BaseModel):
    status: str
    total_days_in_program: int = 0
    days_completed: int = 0
    days_missed: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    adherence_percentage: float = 0.0
    last_completed: str | None = None
    weekly_breakdown: list[dict[str, Any]] = []
    per_exercise: dict[str, Any] = {}
    daily_log: list[dict[str, Any]] = []


@router.get("/{patient_id}/adherence", response_model=AdherenceResponse | None)
async def get_adherence(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> Any:
    """Return adherence data for a patient, computed from real exercise logs."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # For demo patients with hardcoded data, use static adherence
    if patient.external_id.startswith("PT-"):
        adherence = get_adherence_for_patient(patient.external_id, patient.program_type)
        if adherence is not None:
            return adherence

    # For real patients, compute from exercise_logs table
    adherence = await compute_adherence(session, patient_id, patient.external_id, patient.program_type)
    if adherence is None:
        return None
    return adherence


class ScheduleEventResponse(BaseModel):
    id: int
    event_type: str
    scheduled_at: str
    executed_at: str | None = None
    message: str | None = None
    status: str


@router.get("/{patient_id}/schedule", response_model=list[ScheduleEventResponse])
async def get_schedule(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> list[ScheduleEventResponse]:
    """Return schedule events (past and upcoming) for a patient."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    events_result = await session.execute(
        select(ScheduleEvent)
        .where(ScheduleEvent.patient_id == patient_id)
        .order_by(ScheduleEvent.scheduled_at)
    )
    events = events_result.scalars().all()

    return [
        ScheduleEventResponse(
            id=e.id,
            event_type=e.event_type.value,
            scheduled_at=e.scheduled_at.isoformat() if e.scheduled_at else "",
            executed_at=e.executed_at.isoformat() if e.executed_at else None,
            message=e.message,
            status=e.status.value,
        )
        for e in events
    ]


class CreateReminderRequest(BaseModel):
    message: str
    scheduled_at: str  # ISO 8601 datetime


@router.post("/{patient_id}/reminders", response_model=ScheduleEventResponse)
async def create_reminder(
    patient_id: int,
    body: CreateReminderRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> ScheduleEventResponse:
    """Create a reminder for a patient (clinician only)."""
    from app.models.enums import EventType, ScheduleStatus

    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    parsed_time = datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
    event = ScheduleEvent(
        patient_id=patient_id,
        event_type=EventType.REMINDER,
        scheduled_at=parsed_time,
        message=body.message,
        status=ScheduleStatus.PENDING,
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)

    return ScheduleEventResponse(
        id=event.id,
        event_type=event.event_type.value,
        scheduled_at=event.scheduled_at.isoformat() if event.scheduled_at else "",
        executed_at=None,
        message=event.message,
        status=event.status.value,
    )


class FindOrCreateRequest(BaseModel):
    firebase_uid: str
    name: str
    role: str = "patient"


@router.post("/me", response_model=PatientListItem)
async def find_or_create_patient(
    body: FindOrCreateRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(set_audit_user),
) -> PatientListItem:
    """Find patient by Firebase UID, or match by email for first-time signup.

    Patients can only sign up if a clinician has pre-created their record.
    """
    clean_name = body.name

    # 1. Try to find by Firebase UID (returning user)
    result = await session.execute(
        select(Patient).where(Patient.external_id == body.firebase_uid)
    )
    patient = result.scalar_one_or_none()

    if patient is None:
        # 2. Try to match by email (first-time signup linking to clinician-created record)
        email = getattr(user, 'email', None)
        if email:
            email_result = await session.execute(
                select(Patient).where(Patient.email == email)
            )
            patient = email_result.scalar_one_or_none()

        if patient is None:
            raise HTTPException(
                status_code=403,
                detail="Your clinician hasn't set up your account yet. Please contact your care team.",
            )

        # Link the clinician-created record to this Firebase UID
        patient.external_id = body.firebase_uid

    # Update name if provided and different
    if clean_name and patient.name != clean_name:
        patient.name = clean_name

    # Mark as logged in
    if not patient.logged_in:
        patient.logged_in = True

    session.add(patient)
    await session.commit()
    await session.refresh(patient)

    # Adherence
    adh = get_adherence_for_patient(patient.external_id or "", patient.program_type)
    adh_pct = adh["adherence_percentage"] if adh and isinstance(adh, dict) else None

    # Latest confirmed goal
    goal_result = await session.execute(
        select(Goal)
        .where(Goal.patient_id == patient.id, Goal.confirmed == True)  # noqa: E712
        .order_by(Goal.created_at.desc())
    )
    goal = goal_result.scalars().first()

    return PatientListItem(
        id=patient.id,
        name=display_name(patient.name),
        external_id=patient.external_id or "",
        phase=patient.phase.value,
        consent_given=patient.consent_given,
        adherence_pct=adh_pct,
        goal_summary=goal.raw_text if goal else None,
    )


class ConsentUpdate(BaseModel):
    consent_given: bool


class ConsentResponse(BaseModel):
    id: int
    consent_given: bool
    consented_at: datetime | None


@router.get("/{patient_id}/consent", response_model=ConsentResponse)
async def get_consent(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> ConsentResponse:
    """Return current consent status for a patient."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()

    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    return ConsentResponse(
        id=patient.id,
        consent_given=patient.consent_given,
        consented_at=patient.consented_at,
    )


@router.patch("/{patient_id}/consent", response_model=ConsentResponse)
async def update_consent(
    patient_id: int,
    body: ConsentUpdate,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> ConsentResponse:
    """Record or revoke patient consent for outreach."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()

    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient.consent_given = body.consent_given
    patient.consented_at = datetime.now(timezone.utc) if body.consent_given else None
    session.add(patient)
    await session.commit()
    await session.refresh(patient)

    # Auto-transition to ACTIVE after consent if still PENDING
    if body.consent_given and patient.consent_given:
        if patient.phase == PatientPhase.PENDING:
            from app.services.phase_machine import PhaseStateMachine
            machine = PhaseStateMachine(session)
            try:
                await machine.transition(patient.id, PatientPhase.ACTIVE)
            except Exception:
                pass  # May already be transitioned

    return ConsentResponse(
        id=patient.id,
        consent_given=patient.consent_given,
        consented_at=patient.consented_at,
    )


class GoalResponse(BaseModel):
    id: int
    patient_id: int
    raw_text: str
    structured_goal: dict | None = None
    confirmed: bool
    clinician_approved: bool = False
    clinician_rejected: bool = False
    rejection_reason: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


@router.get("/{patient_id}/goals", response_model=list[GoalResponse])
async def get_goals(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> list[GoalResponse]:
    """Return all goals for a patient."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    goal_result = await session.execute(
        select(Goal)
        .where(Goal.patient_id == patient_id)
        .order_by(Goal.created_at)
    )
    goals = goal_result.scalars().all()

    return [
        GoalResponse(
            id=g.id,
            patient_id=g.patient_id,
            raw_text=g.raw_text,
            structured_goal=g.structured_goal,
            confirmed=g.confirmed,
            clinician_approved=g.clinician_approved,
            clinician_rejected=g.clinician_rejected,
            rejection_reason=g.rejection_reason,
            reviewed_at=g.reviewed_at,
            created_at=g.created_at,
        )
        for g in goals
    ]


class MessageMetadata(BaseModel):
    goal_proposed: bool = False
    goal_text: str | None = None
    goal_id: int | None = None


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    metadata: MessageMetadata | None = None


class ConversationResponse(BaseModel):
    id: int
    patient_id: int
    phase_at_creation: str
    started_at: datetime
    messages: list[MessageResponse]


@router.get("/{patient_id}/conversations", response_model=list[ConversationResponse])
async def get_conversations(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> list[ConversationResponse]:
    """Return conversation history with messages for a patient."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    conv_result = await session.execute(
        select(Conversation)
        .where(Conversation.patient_id == patient_id)
        .order_by(Conversation.started_at)
    )
    conversations = conv_result.scalars().all()

    response = []
    for conv in conversations:
        msg_result = await session.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at)
        )
        messages = msg_result.scalars().all()
        msg_responses = []
        for m in messages:
            meta = None
            # Reconstruct goal metadata from persisted tool_calls
            if m.tool_calls:
                for tc in m.tool_calls:
                    if tc.get("name") == "set_goal":
                        # Find the goal that matches this tool call
                        goal_result = await session.execute(
                            select(Goal)
                            .where(Goal.patient_id == conv.patient_id)
                            .order_by(Goal.created_at.desc())
                        )
                        goal = goal_result.scalars().first()
                        if goal:
                            meta = MessageMetadata(
                                goal_proposed=True,
                                goal_text=goal.raw_text,
                                goal_id=goal.id,
                            )
                        break
            msg_responses.append(
                MessageResponse(
                    id=m.id,
                    role=m.role.value,
                    content=m.content,
                    created_at=m.created_at,
                    metadata=meta,
                )
            )
        response.append(
            ConversationResponse(
                id=conv.id,
                patient_id=conv.patient_id,
                phase_at_creation=conv.phase_at_creation.value,
                started_at=conv.started_at,
                messages=msg_responses,
            )
        )
    return response


# ---------------------------------------------------------------------------
# Exercise logging endpoints
# ---------------------------------------------------------------------------


class LogExerciseRequest(BaseModel):
    exercise_id: str
    completed_date: date


class LogExerciseResponse(BaseModel):
    logged: bool
    exercise_id: str
    completed_date: date


@router.post("/{patient_id}/exercises/log", response_model=LogExerciseResponse)
async def log_exercise(
    patient_id: int,
    body: LogExerciseRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> LogExerciseResponse:
    """Log an exercise as completed for a given date."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Consent gate — verified on every patient interaction
    if not patient.logged_in:
        raise HTTPException(status_code=403, detail="Patient must be logged in")
    if not patient.consent_given:
        raise HTTPException(status_code=403, detail="Patient consent required for coaching")

    # Check if already logged
    existing = await session.execute(
        select(ExerciseLog).where(
            ExerciseLog.patient_id == patient_id,
            ExerciseLog.exercise_id == body.exercise_id,
            ExerciseLog.completed_date == body.completed_date,
        )
    )
    if existing.scalar_one_or_none() is None:
        log = ExerciseLog(
            patient_id=patient_id,
            exercise_id=body.exercise_id,
            completed_date=body.completed_date,
        )
        session.add(log)
        await session.commit()

    return LogExerciseResponse(
        logged=True,
        exercise_id=body.exercise_id,
        completed_date=body.completed_date,
    )


@router.delete("/{patient_id}/exercises/log", response_model=LogExerciseResponse)
async def unlog_exercise(
    patient_id: int,
    body: LogExerciseRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> LogExerciseResponse:
    """Remove an exercise completion log for a given date."""
    # Consent gate — verified on every patient interaction
    result_p = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result_p.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.logged_in:
        raise HTTPException(status_code=403, detail="Patient must be logged in")
    if not patient.consent_given:
        raise HTTPException(status_code=403, detail="Patient consent required for coaching")

    result = await session.execute(
        select(ExerciseLog).where(
            ExerciseLog.patient_id == patient_id,
            ExerciseLog.exercise_id == body.exercise_id,
            ExerciseLog.completed_date == body.completed_date,
        )
    )
    log = result.scalar_one_or_none()
    if log:
        await session.delete(log)
        await session.commit()

    return LogExerciseResponse(
        logged=False,
        exercise_id=body.exercise_id,
        completed_date=body.completed_date,
    )


class TodayCompletionsResponse(BaseModel):
    completed_exercise_ids: list[str]


@router.get("/{patient_id}/exercises/today", response_model=TodayCompletionsResponse)
async def get_today_completions(
    patient_id: int,
    target_date: date | None = None,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> TodayCompletionsResponse:
    """Return exercise IDs completed on a given date (defaults to today).

    Only returns IDs that belong to the patient's current program.
    """
    d = target_date or date.today()
    result = await session.execute(
        select(ExerciseLog.exercise_id).where(
            ExerciseLog.patient_id == patient_id,
            ExerciseLog.completed_date == d,
        )
    )
    all_ids = [row[0] for row in result.all()]

    # Filter to only exercise IDs in the current program
    patient_result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = patient_result.scalar_one_or_none()
    if patient:
        program = get_program_for_patient(patient.external_id, patient.program_type)
        if program:
            valid_ids = {ex["id"] for ex in program["exercises"]}
            all_ids = [eid for eid in all_ids if eid in valid_ids]

    return TodayCompletionsResponse(completed_exercise_ids=all_ids)


# ---------------------------------------------------------------------------
# AI-Powered Patient Insights
# ---------------------------------------------------------------------------

INSIGHTS_SYSTEM_PROMPT = (
    "You are a clinical insights assistant for a physical therapy rehabilitation platform.\n"
    "Analyze the patient data below and produce a concise structured summary with these sections:\n\n"
    "## Adherence Trends\n"
    "Brief analysis of their exercise adherence patterns, streaks, and trajectory (2-3 sentences).\n\n"
    "## Risk Level\n"
    "Classify as LOW / MODERATE / HIGH risk of dropping out, with one sentence of reasoning.\n\n"
    "## Engagement Analysis\n"
    "How actively they engage with the AI coach — conversation frequency, responsiveness (2 sentences).\n\n"
    "## Recommended Actions\n"
    "2-3 specific, actionable bullet points for the clinician.\n\n"
    "Be concise and clinical. Use the data to support your assessments."
)


class InsightResponse(BaseModel):
    summary: str
    generated_at: datetime
    is_stale: bool


@router.get("/{patient_id}/insights", response_model=InsightResponse)
async def get_insights(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> InsightResponse:
    """Return AI-generated insights for a patient. Cached for 24h."""
    # Check cache
    result = await session.execute(
        select(PatientInsight).where(PatientInsight.patient_id == patient_id)
    )
    cached = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    cached_time = cached.generated_at if cached else None
    if cached_time and cached_time.tzinfo is None:
        cached_time = cached_time.replace(tzinfo=timezone.utc)
    if cached and cached_time and (now - cached_time).total_seconds() < 86400:
        return InsightResponse(
            summary=cached.summary,
            generated_at=cached.generated_at,
            is_stale=False,
        )

    # Generate new insight
    summary = await _generate_insight(patient_id, session)

    # Upsert cache
    if cached:
        cached.summary = summary
        cached.generated_at = now
        session.add(cached)
    else:
        insight = PatientInsight(patient_id=patient_id, summary=summary, generated_at=now)
        session.add(insight)
    await session.commit()

    return InsightResponse(summary=summary, generated_at=now, is_stale=False)


@router.post("/{patient_id}/insights/refresh", response_model=InsightResponse)
async def refresh_insights(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> InsightResponse:
    """Force-regenerate insights for a patient."""
    summary = await _generate_insight(patient_id, session)
    now = datetime.now(timezone.utc)

    result = await session.execute(
        select(PatientInsight).where(PatientInsight.patient_id == patient_id)
    )
    cached = result.scalar_one_or_none()
    if cached:
        cached.summary = summary
        cached.generated_at = now
        session.add(cached)
    else:
        session.add(PatientInsight(patient_id=patient_id, summary=summary, generated_at=now))
    await session.commit()

    return InsightResponse(summary=summary, generated_at=now, is_stale=False)


async def _generate_insight(patient_id: int, session: AsyncSession) -> str:
    """Gather patient data and call LLM to generate insights."""
    from app.models.conversation import Conversation
    from app.models.message import Message
    from app.services.llm_provider import generate_llm_response

    # Load patient
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Adherence — use real DB for non-demo patients, hardcoded for demo
    adh = get_adherence_for_patient(patient.external_id, patient.program_type)
    if adh is None or (not patient.external_id.startswith("PT-") and patient.program_type):
        real_adh = await compute_adherence(session, patient_id, patient.external_id, patient.program_type)
        if real_adh is not None:
            adh = real_adh

    # Goals
    goal_result = await session.execute(
        select(Goal).where(Goal.patient_id == patient_id, Goal.confirmed == True)  # noqa: E712
        .order_by(Goal.created_at.desc())
    )
    goal = goal_result.scalars().first()

    # Recent messages (last 20)
    conv_result = await session.execute(
        select(Conversation).where(Conversation.patient_id == patient_id)
        .order_by(Conversation.started_at.desc())
    )
    convs = conv_result.scalars().all()
    recent_messages = []
    for conv in convs[:3]:
        msg_result = await session.execute(
            select(Message).where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
        )
        recent_messages.extend(msg_result.scalars().all())
    recent_messages = sorted(recent_messages, key=lambda m: m.created_at)[-20:]

    # Alerts
    from app.models.alert import Alert
    alert_result = await session.execute(
        select(Alert).where(Alert.patient_id == patient_id)
        .order_by(Alert.created_at.desc())
    )
    alerts = alert_result.scalars().all()[:5]

    # Build data text
    data_parts = [
        f"Patient: {patient.name}",
        f"Phase: {patient.phase.value}",
        f"Program: {patient.program_type or 'None assigned'}",
        f"Goal: {goal.raw_text if goal else 'No confirmed goal'}",
    ]

    if adh:
        data_parts.extend([
            f"\nAdherence: {adh.get('adherence_percentage', 0)}%",
            f"Current streak: {adh.get('current_streak', 0)} days",
            f"Days completed: {adh.get('days_completed', 0)}/{adh.get('total_days_in_program', 0)}",
            f"Status: {adh.get('status', 'UNKNOWN')}",
        ])
        if adh.get('weekly_breakdown'):
            weeks = ", ".join(f"Wk{w['week']}: {w['completed']}/{w['total']}" for w in adh['weekly_breakdown'])
            data_parts.append(f"Weekly: {weeks}")
    else:
        data_parts.append("\nAdherence: No data available")

    if recent_messages:
        data_parts.append(f"\nRecent conversation ({len(recent_messages)} messages):")
        for m in recent_messages[-10:]:
            data_parts.append(f"  [{m.role.value}]: {m.content[:150]}")
    else:
        data_parts.append("\nNo conversation history")

    if alerts:
        data_parts.append(f"\nAlerts ({len(alerts)}):")
        for a in alerts:
            data_parts.append(f"  [{a.urgency.value}] {a.reason[:100]}")

    patient_data_text = "\n".join(data_parts)

    try:
        summary = await generate_llm_response(
            messages=[{"role": "user", "content": patient_data_text}],
            system_prompt=INSIGHTS_SYSTEM_PROMPT,
            patient_id=patient_id,
        )
        return summary
    except Exception as e:
        return f"Unable to generate insights at this time. Error: {str(e)[:100]}"


# ---------------------------------------------------------------------------
# Clinical Notes
# ---------------------------------------------------------------------------


class ClinicalNoteResponse(BaseModel):
    id: int
    patient_id: int
    clinician_uid: str
    content: str
    created_at: datetime
    updated_at: datetime


class CreateNoteRequest(BaseModel):
    content: str


@router.get("/{patient_id}/notes", response_model=list[ClinicalNoteResponse])
async def get_patient_notes(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> list[ClinicalNoteResponse]:
    """List clinical notes for a patient (clinician only). Excludes soft-deleted notes."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    notes_result = await session.execute(
        select(ClinicalNote)
        .where(ClinicalNote.patient_id == patient_id, ClinicalNote.deleted_at.is_(None))
        .order_by(ClinicalNote.created_at.desc())
    )
    notes = notes_result.scalars().all()

    return [
        ClinicalNoteResponse(
            id=n.id,
            patient_id=n.patient_id,
            clinician_uid=n.clinician_uid,
            content=n.content,
            created_at=n.created_at,
            updated_at=n.updated_at,
        )
        for n in notes
    ]


@router.post("/{patient_id}/notes", response_model=ClinicalNoteResponse)
async def create_patient_note(
    patient_id: int,
    body: CreateNoteRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_clinician),
) -> ClinicalNoteResponse:
    """Create a clinical note for a patient (clinician only)."""
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    note = ClinicalNote(patient_id=patient_id, clinician_uid=user.uid, content=body.content)
    session.add(note)
    await session.commit()
    await session.refresh(note)

    return ClinicalNoteResponse(
        id=note.id,
        patient_id=note.patient_id,
        clinician_uid=note.clinician_uid,
        content=note.content,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.delete("/{patient_id}/notes/{note_id}")
async def delete_patient_note(
    patient_id: int,
    note_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> dict:
    """Soft-delete a clinical note (clinician only). Record is preserved for audit trail."""
    result = await session.execute(
        select(ClinicalNote).where(
            ClinicalNote.id == note_id,
            ClinicalNote.patient_id == patient_id,
            ClinicalNote.deleted_at.is_(None),
        )
    )
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    note.deleted_at = datetime.now(timezone.utc)
    session.add(note)
    await session.commit()
    return {"deleted": True}


# ── Exercise Ratings ──────────────────────────────────────────────────


class RateExerciseRequest(BaseModel):
    exercise_fingerprint: str
    rating: int


class RateExerciseResponse(BaseModel):
    saved: bool
    already_rated: bool = False


@router.post("/{patient_id}/exercises/rate", response_model=RateExerciseResponse)
async def rate_exercises(
    patient_id: int,
    body: RateExerciseRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> RateExerciseResponse:
    """Save a one-time rating for a completed exercise set."""
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    existing = await session.execute(
        select(ExerciseRating).where(
            ExerciseRating.patient_id == patient_id,
            ExerciseRating.exercise_fingerprint == body.exercise_fingerprint,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return RateExerciseResponse(saved=False, already_rated=True)

    rating = ExerciseRating(
        patient_id=patient_id,
        exercise_fingerprint=body.exercise_fingerprint,
        rating=body.rating,
    )
    session.add(rating)
    await session.commit()
    return RateExerciseResponse(saved=True)


@router.get("/{patient_id}/exercises/rated")
async def get_rated_exercises(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> list[str]:
    """Return list of exercise fingerprints already rated by this patient."""
    result = await session.execute(
        select(ExerciseRating.exercise_fingerprint).where(
            ExerciseRating.patient_id == patient_id,
        )
    )
    return list(result.scalars().all())


# ── Video Progress ───────────────────────────────────────────────────


class VideoProgressRequest(BaseModel):
    exercise_id: str
    watch_percentage: float
    watched_date: str


class VideoProgressResponse(BaseModel):
    saved: bool
    exercise_id: str
    watch_percentage: float
    is_watched: bool


@router.post("/{patient_id}/exercises/video-progress", response_model=VideoProgressResponse)
async def log_video_progress(
    patient_id: int,
    body: VideoProgressRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> VideoProgressResponse:
    """Log or update video watch progress for an exercise.

    Upsert: only updates if new percentage > stored percentage.
    Clamps watch_percentage to 0-100.
    """
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Clamp percentage to 0-100
    pct = max(0.0, min(100.0, body.watch_percentage))
    watched_date = date.fromisoformat(body.watched_date)

    # Check for existing record (upsert)
    existing_result = await session.execute(
        select(VideoWatchLog).where(
            VideoWatchLog.patient_id == patient_id,
            VideoWatchLog.exercise_id == body.exercise_id,
            VideoWatchLog.watched_date == watched_date,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing is not None:
        # Only update if new percentage is higher
        if pct > existing.watch_percentage:
            existing.watch_percentage = pct
            session.add(existing)
            await session.commit()
            await session.refresh(existing)
        final_pct = existing.watch_percentage
    else:
        log = VideoWatchLog(
            patient_id=patient_id,
            exercise_id=body.exercise_id,
            watch_percentage=pct,
            watched_date=watched_date,
        )
        session.add(log)
        await session.commit()
        final_pct = pct

    return VideoProgressResponse(
        saved=True,
        exercise_id=body.exercise_id,
        watch_percentage=final_pct,
        is_watched=final_pct >= 80,
    )


@router.get("/{patient_id}/exercises/video-progress")
async def get_video_progress(
    patient_id: int,
    target_date: str | None = None,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> dict:
    """Return video watch progress for a given date (defaults to today).

    Returns: {"video_progress": {"exercise_id": {"watch_percentage": float, "is_watched": bool}}}
    """
    d = date.fromisoformat(target_date) if target_date else date.today()

    result = await session.execute(
        select(VideoWatchLog).where(
            VideoWatchLog.patient_id == patient_id,
            VideoWatchLog.watched_date == d,
        )
    )
    logs = result.scalars().all()

    video_progress: dict[str, dict] = {}
    for log in logs:
        video_progress[log.exercise_id] = {
            "watch_percentage": log.watch_percentage,
            "is_watched": log.watch_percentage >= 80,
        }

    return {"video_progress": video_progress}


@router.get("/{patient_id}/video-engagement")
async def get_video_engagement(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_own_patient_data),
) -> dict:
    """Aggregate video watch data for clinician view.

    Groups by exercise_id: total_watches, avg_watch_percentage, last_watched, days_watched.
    Returns overall_video_adherence percentage.
    """
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Get program exercise names for mapping
    program = get_program_for_patient(patient.external_id, patient.program_type)
    exercise_names: dict[str, str] = {}
    if program:
        for ex in program.get("exercises", []):
            exercise_names[ex["id"]] = ex.get("name", ex["id"])

    # Aggregate video watch data grouped by exercise_id
    agg_result = await session.execute(
        select(
            VideoWatchLog.exercise_id,
            func.count(VideoWatchLog.id).label("total_watches"),
            func.avg(VideoWatchLog.watch_percentage).label("avg_watch_percentage"),
            func.max(VideoWatchLog.watched_date).label("last_watched"),
            func.count(func.distinct(VideoWatchLog.watched_date)).label("days_watched"),
        )
        .where(VideoWatchLog.patient_id == patient_id)
        .group_by(VideoWatchLog.exercise_id)
    )
    rows = agg_result.all()

    exercises: dict[str, dict] = {}
    total_avg = 0.0
    for row in rows:
        avg_pct = float(row.avg_watch_percentage) if row.avg_watch_percentage else 0.0
        exercises[row.exercise_id] = {
            "exercise_name": exercise_names.get(row.exercise_id, row.exercise_id),
            "total_watches": row.total_watches,
            "avg_watch_percentage": round(avg_pct, 1),
            "last_watched": str(row.last_watched) if row.last_watched else None,
            "days_watched": row.days_watched,
        }
        total_avg += avg_pct

    overall_adherence = round(total_avg / len(rows), 1) if rows else 0.0

    return {
        "patient_id": patient_id,
        "exercises": exercises,
        "overall_video_adherence": overall_adherence,
    }
