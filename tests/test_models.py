"""Tests for TICKET-002: database models and schema for coaching domain."""

from datetime import datetime, timezone

from sqlalchemy import select

from app.models.alert import Alert
from app.models.conversation import Conversation

# These imports should fail initially (RED phase) — modules don't exist yet.
from app.models.enums import (
    AlertStatus,
    AlertUrgency,
    EventType,
    MessageRole,
    PatientPhase,
    SafetyStatus,
    ScheduleStatus,
)
from app.models.goal import Goal
from app.models.message import Message
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent

# ---------------------------------------------------------------------------
# Patient model
# ---------------------------------------------------------------------------

class TestPatientModel:
    async def test_create_patient_with_defaults(self, db_session):
        patient = Patient(external_id="ext-001", name="Jane Doe")
        db_session.add(patient)
        await db_session.commit()

        result = await db_session.execute(select(Patient).where(Patient.id == patient.id))
        fetched = result.scalar_one()

        assert fetched.external_id == "ext-001"
        assert fetched.name == "Jane Doe"
        assert fetched.phase == PatientPhase.PENDING
        assert fetched.consent_given is False
        assert fetched.consented_at is None
        assert fetched.logged_in is False
        assert fetched.unanswered_count == 0
        assert fetched.created_at is not None
        assert fetched.updated_at is not None

    async def test_patient_phase_enum_values(self, db_session):
        for phase in PatientPhase:
            patient = Patient(
                external_id=f"ext-{phase.value}",
                name=f"Patient {phase.value}",
                phase=phase,
            )
            db_session.add(patient)
        await db_session.commit()

        result = await db_session.execute(select(Patient))
        patients = result.scalars().all()
        assert len(patients) == len(PatientPhase)

    async def test_patient_consent_fields(self, db_session):
        now = datetime.now(timezone.utc)
        patient = Patient(
            external_id="ext-consent",
            name="Consent Patient",
            consent_given=True,
            consented_at=now,
        )
        db_session.add(patient)
        await db_session.commit()

        result = await db_session.execute(select(Patient).where(Patient.id == patient.id))
        fetched = result.scalar_one()
        assert fetched.consent_given is True
        assert fetched.consented_at is not None


# ---------------------------------------------------------------------------
# Goal model
# ---------------------------------------------------------------------------

class TestGoalModel:
    async def test_create_goal(self, db_session):
        patient = Patient(external_id="ext-g1", name="Goal Patient")
        db_session.add(patient)
        await db_session.commit()

        goal = Goal(
            patient_id=patient.id,
            raw_text="Walk 30 minutes daily",
            structured_goal={"activity": "walking", "duration": 30, "unit": "minutes"},
            confirmed=False,
        )
        db_session.add(goal)
        await db_session.commit()

        result = await db_session.execute(select(Goal).where(Goal.id == goal.id))
        fetched = result.scalar_one()
        assert fetched.patient_id == patient.id
        assert fetched.raw_text == "Walk 30 minutes daily"
        assert fetched.structured_goal["activity"] == "walking"
        assert fetched.confirmed is False
        assert fetched.created_at is not None

    async def test_goal_fk_to_patient(self, db_session):
        patient = Patient(external_id="ext-g2", name="FK Patient")
        db_session.add(patient)
        await db_session.commit()

        goal = Goal(patient_id=patient.id, raw_text="Eat healthy")
        db_session.add(goal)
        await db_session.commit()

        result = await db_session.execute(select(Goal).where(Goal.patient_id == patient.id))
        fetched = result.scalar_one()
        assert fetched.patient_id == patient.id


# ---------------------------------------------------------------------------
# Conversation model
# ---------------------------------------------------------------------------

class TestConversationModel:
    async def test_create_conversation(self, db_session):
        patient = Patient(external_id="ext-c1", name="Conv Patient")
        db_session.add(patient)
        await db_session.commit()

        conv = Conversation(
            patient_id=patient.id,
            phase_at_creation=PatientPhase.ONBOARDING,
        )
        db_session.add(conv)
        await db_session.commit()

        result = await db_session.execute(select(Conversation).where(Conversation.id == conv.id))
        fetched = result.scalar_one()
        assert fetched.patient_id == patient.id
        assert fetched.phase_at_creation == PatientPhase.ONBOARDING
        assert fetched.started_at is not None
        assert fetched.ended_at is None

    async def test_conversation_ended_at(self, db_session):
        patient = Patient(external_id="ext-c2", name="End Conv Patient")
        db_session.add(patient)
        await db_session.commit()

        now = datetime.now(timezone.utc)
        conv = Conversation(
            patient_id=patient.id,
            phase_at_creation=PatientPhase.ACTIVE,
            ended_at=now,
        )
        db_session.add(conv)
        await db_session.commit()

        result = await db_session.execute(select(Conversation).where(Conversation.id == conv.id))
        fetched = result.scalar_one()
        assert fetched.ended_at is not None


# ---------------------------------------------------------------------------
# Message model
# ---------------------------------------------------------------------------

class TestMessageModel:
    async def test_create_message(self, db_session):
        patient = Patient(external_id="ext-m1", name="Msg Patient")
        db_session.add(patient)
        await db_session.commit()

        conv = Conversation(
            patient_id=patient.id,
            phase_at_creation=PatientPhase.ACTIVE,
        )
        db_session.add(conv)
        await db_session.commit()

        msg = Message(
            conversation_id=conv.id,
            role=MessageRole.PATIENT,
            content="Hello, I need help with my goals.",
            safety_status=SafetyStatus.PASSED,
        )
        db_session.add(msg)
        await db_session.commit()

        result = await db_session.execute(select(Message).where(Message.id == msg.id))
        fetched = result.scalar_one()
        assert fetched.conversation_id == conv.id
        assert fetched.role == MessageRole.PATIENT
        assert fetched.content == "Hello, I need help with my goals."
        assert fetched.safety_status == SafetyStatus.PASSED
        assert fetched.tool_calls is None
        assert fetched.created_at is not None

    async def test_message_with_tool_calls(self, db_session):
        patient = Patient(external_id="ext-m2", name="Tool Patient")
        db_session.add(patient)
        await db_session.commit()

        conv = Conversation(
            patient_id=patient.id,
            phase_at_creation=PatientPhase.ACTIVE,
        )
        db_session.add(conv)
        await db_session.commit()

        tool_data = [{"name": "schedule_followup", "args": {"days": 2}}]
        msg = Message(
            conversation_id=conv.id,
            role=MessageRole.COACH,
            content="Scheduling a follow-up.",
            safety_status=SafetyStatus.PASSED,
            tool_calls=tool_data,
        )
        db_session.add(msg)
        await db_session.commit()

        result = await db_session.execute(select(Message).where(Message.id == msg.id))
        fetched = result.scalar_one()
        assert fetched.tool_calls == tool_data

    async def test_message_safety_status_blocked(self, db_session):
        patient = Patient(external_id="ext-m3", name="Safety Patient")
        db_session.add(patient)
        await db_session.commit()

        conv = Conversation(
            patient_id=patient.id,
            phase_at_creation=PatientPhase.ACTIVE,
        )
        db_session.add(conv)
        await db_session.commit()

        msg = Message(
            conversation_id=conv.id,
            role=MessageRole.SYSTEM,
            content="Content blocked.",
            safety_status=SafetyStatus.BLOCKED,
        )
        db_session.add(msg)
        await db_session.commit()

        result = await db_session.execute(select(Message).where(Message.id == msg.id))
        fetched = result.scalar_one()
        assert fetched.safety_status == SafetyStatus.BLOCKED

    async def test_message_role_enum_values(self, db_session):
        assert MessageRole.PATIENT.value == "PATIENT"
        assert MessageRole.COACH.value == "COACH"
        assert MessageRole.SYSTEM.value == "SYSTEM"

    async def test_safety_status_enum_values(self, db_session):
        assert SafetyStatus.PASSED.value == "PASSED"
        assert SafetyStatus.BLOCKED.value == "BLOCKED"
        assert SafetyStatus.FALLBACK.value == "FALLBACK"


# ---------------------------------------------------------------------------
# ScheduleEvent model
# ---------------------------------------------------------------------------

class TestScheduleEventModel:
    async def test_create_schedule_event(self, db_session):
        patient = Patient(external_id="ext-s1", name="Schedule Patient")
        db_session.add(patient)
        await db_session.commit()

        scheduled_time = datetime.now(timezone.utc)
        event = ScheduleEvent(
            patient_id=patient.id,
            event_type=EventType.DAY_2,
            scheduled_at=scheduled_time,
        )
        db_session.add(event)
        await db_session.commit()

        result = await db_session.execute(
            select(ScheduleEvent).where(ScheduleEvent.id == event.id)
        )
        fetched = result.scalar_one()
        assert fetched.patient_id == patient.id
        assert fetched.event_type == EventType.DAY_2
        assert fetched.executed_at is None
        assert fetched.status == ScheduleStatus.PENDING

    async def test_schedule_event_types(self, db_session):
        assert EventType.DAY_2.value == "DAY_2"
        assert EventType.DAY_5.value == "DAY_5"
        assert EventType.DAY_7.value == "DAY_7"

    async def test_schedule_status_values(self, db_session):
        assert ScheduleStatus.PENDING.value == "PENDING"
        assert ScheduleStatus.SENT.value == "SENT"
        assert ScheduleStatus.SKIPPED.value == "SKIPPED"

    async def test_schedule_event_executed(self, db_session):
        patient = Patient(external_id="ext-s2", name="Exec Patient")
        db_session.add(patient)
        await db_session.commit()

        now = datetime.now(timezone.utc)
        event = ScheduleEvent(
            patient_id=patient.id,
            event_type=EventType.DAY_7,
            scheduled_at=now,
            executed_at=now,
            status=ScheduleStatus.SENT,
        )
        db_session.add(event)
        await db_session.commit()

        result = await db_session.execute(
            select(ScheduleEvent).where(ScheduleEvent.id == event.id)
        )
        fetched = result.scalar_one()
        assert fetched.executed_at is not None
        assert fetched.status == ScheduleStatus.SENT


# ---------------------------------------------------------------------------
# Alert model
# ---------------------------------------------------------------------------

class TestAlertModel:
    async def test_create_alert(self, db_session):
        patient = Patient(external_id="ext-a1", name="Alert Patient")
        db_session.add(patient)
        await db_session.commit()

        alert = Alert(
            patient_id=patient.id,
            reason="Patient expressed distress",
            urgency=AlertUrgency.CRITICAL,
        )
        db_session.add(alert)
        await db_session.commit()

        result = await db_session.execute(select(Alert).where(Alert.id == alert.id))
        fetched = result.scalar_one()
        assert fetched.patient_id == patient.id
        assert fetched.reason == "Patient expressed distress"
        assert fetched.urgency == AlertUrgency.CRITICAL
        assert fetched.status == AlertStatus.NEW
        assert fetched.acknowledged_at is None
        assert fetched.created_at is not None

    async def test_alert_acknowledged(self, db_session):
        patient = Patient(external_id="ext-a2", name="Ack Patient")
        db_session.add(patient)
        await db_session.commit()

        now = datetime.now(timezone.utc)
        alert = Alert(
            patient_id=patient.id,
            reason="High risk",
            urgency=AlertUrgency.HIGH,
            status=AlertStatus.ACKNOWLEDGED,
            acknowledged_at=now,
        )
        db_session.add(alert)
        await db_session.commit()

        result = await db_session.execute(select(Alert).where(Alert.id == alert.id))
        fetched = result.scalar_one()
        assert fetched.status == AlertStatus.ACKNOWLEDGED
        assert fetched.acknowledged_at is not None

    async def test_alert_urgency_enum_values(self, db_session):
        assert AlertUrgency.CRITICAL.value == "CRITICAL"
        assert AlertUrgency.HIGH.value == "HIGH"
        assert AlertUrgency.NORMAL.value == "NORMAL"


# ---------------------------------------------------------------------------
# Foreign key relationship tests
# ---------------------------------------------------------------------------

class TestForeignKeyRelationships:
    async def test_patient_has_goals(self, db_session):
        patient = Patient(external_id="ext-fk1", name="FK Test")
        db_session.add(patient)
        await db_session.commit()

        goal1 = Goal(patient_id=patient.id, raw_text="Goal 1")
        goal2 = Goal(patient_id=patient.id, raw_text="Goal 2")
        db_session.add_all([goal1, goal2])
        await db_session.commit()

        result = await db_session.execute(
            select(Goal).where(Goal.patient_id == patient.id)
        )
        goals = result.scalars().all()
        assert len(goals) == 2

    async def test_patient_has_conversations(self, db_session):
        patient = Patient(external_id="ext-fk2", name="Conv FK Test")
        db_session.add(patient)
        await db_session.commit()

        conv = Conversation(
            patient_id=patient.id,
            phase_at_creation=PatientPhase.ONBOARDING,
        )
        db_session.add(conv)
        await db_session.commit()

        result = await db_session.execute(
            select(Conversation).where(Conversation.patient_id == patient.id)
        )
        convs = result.scalars().all()
        assert len(convs) == 1

    async def test_conversation_has_messages(self, db_session):
        patient = Patient(external_id="ext-fk3", name="Msg FK Test")
        db_session.add(patient)
        await db_session.commit()

        conv = Conversation(
            patient_id=patient.id,
            phase_at_creation=PatientPhase.ACTIVE,
        )
        db_session.add(conv)
        await db_session.commit()

        msg1 = Message(
            conversation_id=conv.id,
            role=MessageRole.PATIENT,
            content="Hello",
            safety_status=SafetyStatus.PASSED,
        )
        msg2 = Message(
            conversation_id=conv.id,
            role=MessageRole.COACH,
            content="Hi there",
            safety_status=SafetyStatus.PASSED,
        )
        db_session.add_all([msg1, msg2])
        await db_session.commit()

        result = await db_session.execute(
            select(Message).where(Message.conversation_id == conv.id)
        )
        messages = result.scalars().all()
        assert len(messages) == 2

    async def test_patient_has_schedule_events(self, db_session):
        patient = Patient(external_id="ext-fk4", name="Sched FK Test")
        db_session.add(patient)
        await db_session.commit()

        now = datetime.now(timezone.utc)
        event = ScheduleEvent(
            patient_id=patient.id,
            event_type=EventType.DAY_5,
            scheduled_at=now,
        )
        db_session.add(event)
        await db_session.commit()

        result = await db_session.execute(
            select(ScheduleEvent).where(ScheduleEvent.patient_id == patient.id)
        )
        events = result.scalars().all()
        assert len(events) == 1

    async def test_patient_has_alerts(self, db_session):
        patient = Patient(external_id="ext-fk5", name="Alert FK Test")
        db_session.add(patient)
        await db_session.commit()

        alert = Alert(
            patient_id=patient.id,
            reason="Test alert",
            urgency=AlertUrgency.NORMAL,
        )
        db_session.add(alert)
        await db_session.commit()

        result = await db_session.execute(
            select(Alert).where(Alert.patient_id == patient.id)
        )
        alerts = result.scalars().all()
        assert len(alerts) == 1


# ---------------------------------------------------------------------------
# Table existence test
# ---------------------------------------------------------------------------

class TestTableExistence:
    async def test_all_tables_exist(self, db_session):
        """Verify all required tables are created."""
        from app.database import Base

        table_names = set(Base.metadata.tables.keys())
        expected = {"patients", "goals", "conversations", "messages", "schedule_events", "alerts"}
        assert expected.issubset(table_names), f"Missing tables: {expected - table_names}"
