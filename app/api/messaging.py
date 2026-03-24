"""Direct messaging between clinicians and patients."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.api.dependencies import require_own_patient_data, set_audit_user
from app.middleware.auth import AuthenticatedUser, require_clinician
from app.models.direct_message import DirectMessage
from app.models.patient import Patient

router = APIRouter(prefix="/api/messages", tags=["messages"])


class SendMessageRequest(BaseModel):
    patient_id: int
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message content must not be empty")
        if len(v) > 5000:
            raise ValueError("Message content must not exceed 5000 characters")
        return v


class BroadcastRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Broadcast content must not be empty")
        if len(v) > 5000:
            raise ValueError("Broadcast content must not exceed 5000 characters")
        return v


class DirectMessageResponse(BaseModel):
    id: int
    sender_role: str
    content: str
    is_broadcast: bool
    read_at: datetime | None
    created_at: datetime


class UnreadCountResponse(BaseModel):
    count: int


@router.post("", response_model=DirectMessageResponse)
async def send_message(
    body: SendMessageRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> DirectMessageResponse:
    """Clinician sends a direct message to a patient."""
    result = await session.execute(select(Patient).where(Patient.id == body.patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    msg = DirectMessage(
        sender_role="clinician",
        patient_id=body.patient_id,
        content=body.content,
    )
    session.add(msg)
    await session.commit()
    await session.refresh(msg)

    return DirectMessageResponse(
        id=msg.id,
        sender_role=msg.sender_role,
        content=msg.content,
        is_broadcast=msg.is_broadcast,
        read_at=msg.read_at,
        created_at=msg.created_at,
    )


@router.post("/broadcast", response_model=dict)
async def broadcast_message(
    body: BroadcastRequest,
    session: AsyncSession = Depends(get_session),
    _user: AuthenticatedUser = Depends(require_clinician),
) -> dict:
    """Clinician sends a message to all patients."""
    result = await session.execute(select(Patient))
    patients = result.scalars().all()

    for p in patients:
        msg = DirectMessage(
            sender_role="clinician",
            patient_id=p.id,
            content=body.content,
            is_broadcast=True,
        )
        session.add(msg)

    await session.commit()
    return {"sent_count": len(patients)}


@router.post("/patient-reply", response_model=DirectMessageResponse)
async def patient_reply(
    body: SendMessageRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(set_audit_user),
) -> DirectMessageResponse:
    """Patient sends a reply to their clinician."""
    result = await session.execute(select(Patient).where(Patient.id == body.patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Patients can only send messages as themselves
    if user.role == "patient" and patient.external_id != user.uid:
        raise HTTPException(status_code=403, detail="Access denied — not your data")

    msg = DirectMessage(
        sender_role="patient",
        patient_id=body.patient_id,
        content=body.content,
    )
    session.add(msg)
    await session.commit()
    await session.refresh(msg)

    return DirectMessageResponse(
        id=msg.id,
        sender_role=msg.sender_role,
        content=msg.content,
        is_broadcast=msg.is_broadcast,
        read_at=msg.read_at,
        created_at=msg.created_at,
    )


@router.get("/patient/{patient_id}", response_model=list[DirectMessageResponse])
async def get_messages(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(set_audit_user),
) -> list[DirectMessageResponse]:
    """Get all direct messages for a patient."""
    # Patients can only view their own messages
    if user.role == "patient":
        result_p = await session.execute(select(Patient).where(Patient.id == patient_id))
        patient = result_p.scalar_one_or_none()
        if patient is None or patient.external_id != user.uid:
            raise HTTPException(status_code=403, detail="Access denied — not your data")
    result = await session.execute(
        select(DirectMessage)
        .where(DirectMessage.patient_id == patient_id)
        .order_by(DirectMessage.created_at)
    )
    messages = result.scalars().all()
    return [
        DirectMessageResponse(
            id=m.id,
            sender_role=m.sender_role,
            content=m.content,
            is_broadcast=m.is_broadcast,
            read_at=m.read_at,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.patch("/{message_id}/read")
async def mark_read(
    message_id: int,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(set_audit_user),
) -> dict:
    """Mark a message as read."""
    result = await session.execute(select(DirectMessage).where(DirectMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if msg is None:
        raise HTTPException(status_code=404, detail="Message not found")

    # Patients can only mark messages in their own thread
    if user.role == "patient":
        result_p = await session.execute(select(Patient).where(Patient.id == msg.patient_id))
        patient = result_p.scalar_one_or_none()
        if patient is None or patient.external_id != user.uid:
            raise HTTPException(status_code=403, detail="Access denied — not your data")

    if not msg.read_at:
        msg.read_at = datetime.now(timezone.utc)
        session.add(msg)
        await session.commit()
    return {"ok": True}


@router.get("/patient/{patient_id}/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    patient_id: int,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(set_audit_user),
) -> UnreadCountResponse:
    """Get count of unread messages for a patient."""
    # Patients can only view their own unread count
    if user.role == "patient":
        result_p = await session.execute(select(Patient).where(Patient.id == patient_id))
        patient = result_p.scalar_one_or_none()
        if patient is None or patient.external_id != user.uid:
            raise HTTPException(status_code=403, detail="Access denied — not your data")
    result = await session.execute(
        select(func.count(DirectMessage.id)).where(
            DirectMessage.patient_id == patient_id,
            DirectMessage.sender_role == "clinician",
            DirectMessage.read_at.is_(None),
        )
    )
    count = result.scalar() or 0
    return UnreadCountResponse(count=count)
