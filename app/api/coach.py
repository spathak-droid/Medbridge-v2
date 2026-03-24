"""Coach interaction endpoints — wired to LangGraph pipeline."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi.responses import StreamingResponse

from app.database import async_session_factory, get_session
from app.api.dependencies import set_audit_user
from app.middleware.auth import AuthenticatedUser
from app.models.conversation import Conversation
from app.models.enums import MessageRole, PatientPhase, SafetyStatus
from app.models.message import Message
from app.models.patient import Patient
from app.services.coach_service import run_coach_turn, run_coach_turn_stream
from app.services.disengagement import DisengagementHandler
from app.services.phase_machine import PhaseStateMachine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coach", tags=["coach"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class StartOnboardingRequest(BaseModel):
    patient_id: int


class MessageMetadata(BaseModel):
    goal_proposed: bool = False
    goal_text: str | None = None
    goal_id: int | None = None

    @field_validator("goal_text")
    @classmethod
    def goal_text_max_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 10000:
            raise ValueError("Goal text must not exceed 10,000 characters")
        return v


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    metadata: MessageMetadata | None = None


class StartOnboardingResponse(BaseModel):
    conversation_id: int
    coach_message: MessageOut


class SendMessageRequest(BaseModel):
    patient_id: int
    content: str
    conversation_id: int | None = None

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message content must not be empty")
        if len(v) > 10000:
            raise ValueError("Message content must not exceed 10,000 characters")
        return v


class NewConversationRequest(BaseModel):
    patient_id: int


class NewConversationResponse(BaseModel):
    conversation_id: int
    started_at: datetime


class SendMessageResponse(BaseModel):
    conversation_id: int
    patient_message: MessageOut
    coach_message: MessageOut


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_goal_metadata(coach_msg: Message) -> MessageMetadata | None:
    """Extract goal metadata from coach_service's transient attribute."""
    meta = getattr(coach_msg, "_goal_metadata", None)
    if meta and meta.get("goal_proposed"):
        return MessageMetadata(
            goal_proposed=True,
            goal_text=meta.get("goal_text"),
            goal_id=meta.get("goal_id"),
        )
    return None


async def _verify_consent(patient: Patient) -> None:
    """Check consent on every coach interaction. Raises 403 if not met."""
    if not patient.logged_in:
        raise HTTPException(status_code=403, detail="Patient must be logged in")
    if not patient.consent_given:
        raise HTTPException(status_code=403, detail="Patient consent required for coaching")


async def _resolve_conversation(
    session: AsyncSession,
    patient: Patient,
    conversation_id: int | None,
) -> Conversation:
    """Resolve a conversation by ID or fall back to the latest one, creating if needed."""
    if conversation_id is not None:
        conv_result = await session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.patient_id == patient.id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation

    # Fall back to latest conversation
    conv_result = await session.execute(
        select(Conversation)
        .where(Conversation.patient_id == patient.id)
        .order_by(Conversation.started_at.desc())
    )
    conversation = conv_result.scalar_one_or_none()
    if conversation is None:
        conversation = Conversation(
            patient_id=patient.id,
            phase_at_creation=patient.phase,
        )
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
    return conversation


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/start-onboarding", response_model=StartOnboardingResponse)
async def start_onboarding(
    body: StartOnboardingRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> StartOnboardingResponse:
    """Start onboarding — transitions patient, creates conversation, calls LLM."""
    result = await session.execute(select(Patient).where(Patient.id == body.patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Consent gate — verified on every interaction
    await _verify_consent(patient)

    # Transition to ONBOARDING via state machine
    machine = PhaseStateMachine(session)
    try:
        await machine.transition(patient.id, PatientPhase.ONBOARDING)
    except Exception:
        # Already in ONBOARDING or later phase — allow re-entry
        pass

    # Create conversation
    conversation = Conversation(
        patient_id=patient.id,
        phase_at_creation=PatientPhase.ONBOARDING,
    )
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)

    # Run the onboarding graph for the initial coach message
    try:
        coach_msg = await run_coach_turn(
            session=session,
            patient_id=patient.id,
            conversation_id=conversation.id,
        )
    except Exception:
        logger.exception("LLM call failed during onboarding, using fallback")
        coach_msg = Message(
            conversation_id=conversation.id,
            role=MessageRole.COACH,
            content=(
                "Welcome to MedBridge! I'm your exercise coach. "
                "I'll help you set goals and build a plan that works for you. "
                "To get started, could you tell me a bit about your current "
                "activity level and what you'd like to achieve?"
            ),
            safety_status=SafetyStatus.PASSED,
            created_at=datetime.now(timezone.utc),
        )
        session.add(coach_msg)
        await session.commit()
        await session.refresh(coach_msg)

    # Build metadata if goal was proposed
    meta = _extract_goal_metadata(coach_msg)

    return StartOnboardingResponse(
        conversation_id=conversation.id,
        coach_message=MessageOut(
            id=coach_msg.id,
            role=coach_msg.role.value,
            content=coach_msg.content,
            created_at=coach_msg.created_at,
            metadata=meta,
        ),
    )


@router.post("/new-conversation", response_model=NewConversationResponse)
async def create_new_conversation(
    body: NewConversationRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> NewConversationResponse:
    """Create a new empty conversation for a patient."""
    result = await session.execute(select(Patient).where(Patient.id == body.patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    await _verify_consent(patient)

    conversation = Conversation(
        patient_id=patient.id,
        phase_at_creation=patient.phase,
    )
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)

    return NewConversationResponse(
        conversation_id=conversation.id,
        started_at=conversation.started_at,
    )


@router.post("/message", response_model=SendMessageResponse)
async def send_message(
    body: SendMessageRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
) -> SendMessageResponse:
    """Accept a patient message, run it through the LangGraph pipeline."""
    result = await session.execute(select(Patient).where(Patient.id == body.patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Consent gate — verified on every interaction
    await _verify_consent(patient)

    # Resolve conversation (by ID or latest)
    conversation = await _resolve_conversation(session, patient, body.conversation_id)

    # Store patient message
    now = datetime.now(timezone.utc)
    patient_msg = Message(
        conversation_id=conversation.id,
        role=MessageRole.PATIENT,
        content=body.content,
        safety_status=SafetyStatus.PASSED,
        created_at=now,
    )
    session.add(patient_msg)
    await session.commit()
    await session.refresh(patient_msg)

    # Track patient response for disengagement (resets unanswered count,
    # transitions DORMANT→RE_ENGAGING if applicable)
    try:
        handler = DisengagementHandler(session)
        await handler.record_response(patient.id)
    except Exception:
        logger.debug("Disengagement record_response skipped for patient %s", patient.id)

    # Run through LangGraph pipeline
    try:
        coach_msg = await run_coach_turn(
            session=session,
            patient_id=patient.id,
            conversation_id=conversation.id,
            user_message_content=body.content,
        )
    except Exception:
        logger.exception("LLM call failed, using fallback response")
        coach_msg = Message(
            conversation_id=conversation.id,
            role=MessageRole.COACH,
            content="I'm here to help with your exercise goals! How can I support you today?",
            safety_status=SafetyStatus.FALLBACK,
            created_at=datetime.now(timezone.utc),
        )
        session.add(coach_msg)
        await session.commit()
        await session.refresh(coach_msg)

    # Build metadata if goal was proposed
    meta = _extract_goal_metadata(coach_msg)

    return SendMessageResponse(
        conversation_id=conversation.id,
        patient_message=MessageOut(
            id=patient_msg.id,
            role=patient_msg.role.value,
            content=patient_msg.content,
            created_at=patient_msg.created_at,
        ),
        coach_message=MessageOut(
            id=coach_msg.id,
            role=coach_msg.role.value,
            content=coach_msg.content,
            created_at=coach_msg.created_at,
            metadata=meta,
        ),
    )


@router.post("/message/stream")
async def send_message_stream(
    body: SendMessageRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(set_audit_user),
):
    """Accept a patient message and stream the coach response via SSE."""
    import json

    # Validate patient
    result = await session.execute(select(Patient).where(Patient.id == body.patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Consent gate — verified on every interaction
    await _verify_consent(patient)

    # Resolve conversation (by ID or latest)
    conversation = await _resolve_conversation(session, patient, body.conversation_id)

    # Store patient message
    now = datetime.now(timezone.utc)
    patient_msg = Message(
        conversation_id=conversation.id,
        role=MessageRole.PATIENT,
        content=body.content,
        safety_status=SafetyStatus.PASSED,
        created_at=now,
    )
    session.add(patient_msg)
    await session.commit()
    await session.refresh(patient_msg)

    # Track patient response for disengagement
    try:
        handler = DisengagementHandler(session)
        await handler.record_response(patient.id)
    except Exception:
        logger.debug("Disengagement record_response skipped for patient %s", patient.id)

    # Capture IDs for the streaming generator (which will use its own session)
    _patient_id = patient.id
    _conversation_id = conversation.id
    _user_content = body.content

    async def event_generator():
        """SSE event generator using its own DB session."""
        try:
            async with async_session_factory() as stream_session:
                async for event in run_coach_turn_stream(
                    session=stream_session,
                    patient_id=_patient_id,
                    conversation_id=_conversation_id,
                    user_message_content=_user_content,
                ):
                    yield event
        except Exception as e:
            logger.exception("Streaming failed")
            error_event = f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"
            yield error_event

    return StreamingResponse(
        content=event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
