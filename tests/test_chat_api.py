"""Tests for chat API endpoints — TICKET-015.

GET /api/patients/{id}/conversations — returns conversation history with messages.
POST /api/coach/message — sends a patient message and returns coach response.
"""

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.main import app
from app.models.conversation import Conversation
from app.models.enums import MessageRole, PatientPhase, SafetyStatus
from app.models.message import Message
from app.models.patient import Patient


async def _seed_patient(
    session: AsyncSession,
    *,
    external_id: str = "chat-pat-001",
    name: str = "Chat Patient",
    consent_given: bool = True,
    logged_in: bool = True,
    phase: PatientPhase = PatientPhase.ACTIVE,
) -> Patient:
    patient = Patient(
        external_id=external_id,
        name=name,
        consent_given=consent_given,
        logged_in=logged_in,
        phase=phase,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


async def _seed_conversation_with_messages(
    session: AsyncSession,
    patient_id: int,
    *,
    phase: PatientPhase = PatientPhase.ACTIVE,
    message_count: int = 3,
) -> Conversation:
    conv = Conversation(patient_id=patient_id, phase_at_creation=phase)
    session.add(conv)
    await session.commit()
    await session.refresh(conv)

    for i in range(message_count):
        role = MessageRole.PATIENT if i % 2 == 0 else MessageRole.COACH
        msg = Message(
            conversation_id=conv.id,
            role=role,
            content=f"Test message {i}",
            safety_status=SafetyStatus.PASSED,
        )
        session.add(msg)
    await session.commit()
    return conv


class TestGetConversations:
    """GET /api/patients/{id}/conversations."""

    async def test_returns_conversations_with_messages(self, db_session: AsyncSession):
        """Returns conversation list with nested messages in chronological order."""
        patient = await _seed_patient(db_session)
        await _seed_conversation_with_messages(db_session, patient.id)

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get(f"/api/patients/{patient.id}/conversations")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1
            conv = data[0]
            assert conv["patient_id"] == patient.id
            assert "messages" in conv
            assert len(conv["messages"]) == 3
        finally:
            app.dependency_overrides.clear()

    async def test_empty_conversations_for_new_patient(self, db_session: AsyncSession):
        """New patient with no conversations returns empty list."""
        patient = await _seed_patient(db_session, external_id="chat-pat-new")

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get(f"/api/patients/{patient.id}/conversations")
            assert resp.status_code == 200
            data = resp.json()
            assert data == []
        finally:
            app.dependency_overrides.clear()

    async def test_messages_include_role_and_timestamp(self, db_session: AsyncSession):
        """Each message includes role, content, and created_at."""
        patient = await _seed_patient(db_session, external_id="chat-pat-fields")
        await _seed_conversation_with_messages(db_session, patient.id, message_count=2)

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get(f"/api/patients/{patient.id}/conversations")
            data = resp.json()
            msg = data[0]["messages"][0]
            assert "role" in msg
            assert "content" in msg
            assert "created_at" in msg
        finally:
            app.dependency_overrides.clear()

    async def test_nonexistent_patient_returns_404(self, db_session: AsyncSession):
        """GET conversations for nonexistent patient returns 404."""
        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/patients/99999/conversations")
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()

    async def test_fallback_messages_display_normally(self, db_session: AsyncSession):
        """Messages with FALLBACK safety status are returned normally (no indication)."""
        patient = await _seed_patient(db_session, external_id="chat-pat-fallback")
        conv = Conversation(patient_id=patient.id, phase_at_creation=PatientPhase.ACTIVE)
        db_session.add(conv)
        await db_session.commit()
        await db_session.refresh(conv)

        msg = Message(
            conversation_id=conv.id,
            role=MessageRole.COACH,
            content="I understand. Let me help you with that.",
            safety_status=SafetyStatus.FALLBACK,
        )
        db_session.add(msg)
        await db_session.commit()

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get(f"/api/patients/{patient.id}/conversations")
            data = resp.json()
            msg_data = data[0]["messages"][0]
            # Safety status should NOT be exposed to the patient
            assert "safety_status" not in msg_data
            assert msg_data["content"] == "I understand. Let me help you with that."
        finally:
            app.dependency_overrides.clear()


class TestPostCoachMessage:
    """POST /api/coach/message."""

    async def test_send_message_returns_coach_response(self, db_session: AsyncSession):
        """Sending a patient message returns coach response."""
        patient = await _seed_patient(db_session, external_id="chat-pat-msg")
        # Create a conversation for the patient
        conv = Conversation(patient_id=patient.id, phase_at_creation=PatientPhase.ACTIVE)
        db_session.add(conv)
        await db_session.commit()
        await db_session.refresh(conv)

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/coach/message",
                    json={
                        "patient_id": patient.id,
                        "content": "Hello coach!",
                    },
                )
            assert resp.status_code == 200
            data = resp.json()
            assert "patient_message" in data
            assert "coach_message" in data
            assert data["patient_message"]["role"] == "PATIENT"
            assert data["coach_message"]["role"] == "COACH"
            assert data["patient_message"]["content"] == "Hello coach!"
        finally:
            app.dependency_overrides.clear()

    async def test_send_message_creates_conversation_if_none(self, db_session: AsyncSession):
        """If patient has no conversation, one is created automatically."""
        patient = await _seed_patient(
            db_session, external_id="chat-pat-noconv", phase=PatientPhase.ONBOARDING
        )

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/coach/message",
                    json={
                        "patient_id": patient.id,
                        "content": "Hi, starting onboarding!",
                    },
                )
            assert resp.status_code == 200
            data = resp.json()
            assert "conversation_id" in data
        finally:
            app.dependency_overrides.clear()

    async def test_send_message_nonexistent_patient_returns_404(self, db_session: AsyncSession):
        """POST message for nonexistent patient returns 404."""
        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/coach/message",
                    json={
                        "patient_id": 99999,
                        "content": "Hello?",
                    },
                )
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()

    async def test_send_empty_message_returns_422(self, db_session: AsyncSession):
        """POST with empty content returns 422."""
        patient = await _seed_patient(db_session, external_id="chat-pat-empty")

        app.dependency_overrides[get_session] = lambda: db_session
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/coach/message",
                    json={
                        "patient_id": patient.id,
                        "content": "",
                    },
                )
            assert resp.status_code == 422
        finally:
            app.dependency_overrides.clear()
