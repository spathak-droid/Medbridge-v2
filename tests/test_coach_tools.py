"""Tests for TICKET-006: coach tool interfaces and stub implementations.

Covers all acceptance criteria:
- Each tool has name, description, input schema, return type
- set_goal persists to Goal model
- set_reminder creates a ScheduleEvent record
- get_program_summary returns structured exercise summary (stubbed)
- get_adherence_summary returns adherence stats (stubbed)
- alert_clinician creates an Alert record
- Tools are registerable with LangGraph ToolNode
"""

from langchain_core.tools import BaseTool
from langgraph.prebuilt import ToolNode
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.enums import AlertStatus, AlertUrgency, EventType, ScheduleStatus
from app.models.goal import Goal
from app.models.patient import Patient
from app.models.schedule_event import ScheduleEvent
from app.tools.coach_tools import make_coach_tools


async def _create_patient(
    session: AsyncSession,
    *,
    external_id: str = "tool-pat-001",
    name: str = "Tool Test Patient",
) -> Patient:
    patient = Patient(
        external_id=external_id,
        name=name,
        logged_in=True,
        consent_given=True,
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


# ---------------------------------------------------------------------------
# Tool metadata tests
# ---------------------------------------------------------------------------


class TestToolMetadata:
    """Each tool has: name, description, input schema, and return type."""

    async def test_make_coach_tools_returns_six_tools(self, db_session):
        patient = await _create_patient(db_session)
        tools = make_coach_tools(db_session, patient.id)
        assert len(tools) == 6

    async def test_all_tools_are_base_tool_instances(self, db_session):
        patient = await _create_patient(db_session, external_id="tool-meta-2")
        tools = make_coach_tools(db_session, patient.id)
        for t in tools:
            assert isinstance(t, BaseTool), f"{t} is not a BaseTool"

    async def test_tool_names(self, db_session):
        patient = await _create_patient(db_session, external_id="tool-meta-3")
        tools = make_coach_tools(db_session, patient.id)
        names = {t.name for t in tools}
        expected = {
            "set_goal",
            "set_reminder",
            "assign_program",
            "get_program_summary",
            "get_adherence_summary",
            "alert_clinician",
        }
        assert names == expected

    async def test_each_tool_has_description(self, db_session):
        patient = await _create_patient(db_session, external_id="tool-meta-4")
        tools = make_coach_tools(db_session, patient.id)
        for t in tools:
            assert t.description, f"Tool {t.name} has no description"

    async def test_each_tool_has_input_schema(self, db_session):
        patient = await _create_patient(db_session, external_id="tool-meta-5")
        tools = make_coach_tools(db_session, patient.id)
        for t in tools:
            schema = t.get_input_schema().model_json_schema()
            assert "properties" in schema or schema.get("type") == "object", (
                f"Tool {t.name} has no input schema"
            )


# ---------------------------------------------------------------------------
# set_goal tool
# ---------------------------------------------------------------------------


class TestSetGoalTool:
    async def test_set_goal_persists_to_db(self, db_session: AsyncSession):
        patient = await _create_patient(db_session)
        tools = make_coach_tools(db_session, patient.id)
        set_goal = next(t for t in tools if t.name == "set_goal")

        result = await set_goal.ainvoke(
            {"goal_text": "Walk 30 minutes daily"}
        )

        assert "Walk 30 minutes daily" in result

        # Verify persisted to DB
        db_result = await db_session.execute(
            select(Goal).where(Goal.patient_id == patient.id)
        )
        goal = db_result.scalar_one()
        assert goal.raw_text == "Walk 30 minutes daily"
        assert goal.patient_id == patient.id

    async def test_set_goal_returns_confirmation_string(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-sg2")
        tools = make_coach_tools(db_session, patient.id)
        set_goal = next(t for t in tools if t.name == "set_goal")

        result = await set_goal.ainvoke(
            {"goal_text": "Stretch every morning"}
        )
        assert isinstance(result, str)
        assert len(result) > 0


# ---------------------------------------------------------------------------
# set_reminder tool
# ---------------------------------------------------------------------------


class TestSetReminderTool:
    async def test_set_reminder_creates_schedule_event(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-sr1")
        tools = make_coach_tools(db_session, patient.id)
        set_reminder = next(t for t in tools if t.name == "set_reminder")

        scheduled_time = "2025-01-15T09:00:00Z"
        result = await set_reminder.ainvoke(
            {
                "message": "Time for your exercises!",
                "scheduled_time": scheduled_time,
            }
        )

        assert isinstance(result, str)

        # Verify ScheduleEvent persisted
        db_result = await db_session.execute(
            select(ScheduleEvent).where(ScheduleEvent.patient_id == patient.id)
        )
        event = db_result.scalar_one()
        assert event.patient_id == patient.id
        assert event.event_type == EventType.REMINDER
        assert event.status == ScheduleStatus.PENDING

    async def test_set_reminder_returns_confirmation(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-sr2")
        tools = make_coach_tools(db_session, patient.id)
        set_reminder = next(t for t in tools if t.name == "set_reminder")

        result = await set_reminder.ainvoke(
            {
                "message": "Don't forget to hydrate",
                "scheduled_time": "2025-02-01T10:00:00Z",
            }
        )
        assert "reminder" in result.lower() or "scheduled" in result.lower()


# ---------------------------------------------------------------------------
# get_program_summary tool
# ---------------------------------------------------------------------------


class TestGetProgramSummaryTool:
    async def test_returns_structured_summary(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-ps1")
        tools = make_coach_tools(db_session, patient.id)
        get_program_summary = next(t for t in tools if t.name == "get_program_summary")

        result = await get_program_summary.ainvoke({})
        assert isinstance(result, str)
        assert len(result) > 0

    async def test_contains_exercise_information(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-ps2")
        tools = make_coach_tools(db_session, patient.id)
        get_program_summary = next(t for t in tools if t.name == "get_program_summary")

        result = await get_program_summary.ainvoke({})
        # Stubbed data should mention exercises
        result_lower = result.lower()
        assert "exercise" in result_lower or "program" in result_lower


# ---------------------------------------------------------------------------
# get_adherence_summary tool
# ---------------------------------------------------------------------------


class TestGetAdherenceSummaryTool:
    async def test_returns_adherence_stats(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-as1")
        tools = make_coach_tools(db_session, patient.id)
        get_adherence = next(t for t in tools if t.name == "get_adherence_summary")

        result = await get_adherence.ainvoke({})
        assert isinstance(result, str)
        assert len(result) > 0

    async def test_contains_adherence_metrics(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-as2")
        tools = make_coach_tools(db_session, patient.id)
        get_adherence = next(t for t in tools if t.name == "get_adherence_summary")

        result = await get_adherence.ainvoke({})
        result_lower = result.lower()
        # For patients without adherence data, returns PENDING status message
        # For patients with data, returns days/streak/percentage info
        assert any(
            keyword in result_lower
            for keyword in ["days", "streak", "percentage", "completed", "%", "pending", "status"]
        )


# ---------------------------------------------------------------------------
# alert_clinician tool
# ---------------------------------------------------------------------------


class TestAlertClinicianTool:
    async def test_alert_clinician_persists_alert(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-ac1")
        tools = make_coach_tools(db_session, patient.id)
        alert_clinician = next(t for t in tools if t.name == "alert_clinician")

        result = await alert_clinician.ainvoke(
            {
                "reason": "Patient reported severe pain",
                "urgency": "CRITICAL",
            }
        )

        assert isinstance(result, str)

        # Verify Alert persisted
        db_result = await db_session.execute(
            select(Alert).where(Alert.patient_id == patient.id)
        )
        alert = db_result.scalar_one()
        assert alert.patient_id == patient.id
        assert alert.reason == "Patient reported severe pain"
        assert alert.urgency == AlertUrgency.CRITICAL
        assert alert.status == AlertStatus.NEW

    async def test_alert_clinician_supports_urgency_levels(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-ac2")
        tools = make_coach_tools(db_session, patient.id)
        alert_clinician = next(t for t in tools if t.name == "alert_clinician")

        for urgency in ["CRITICAL", "HIGH", "NORMAL"]:
            result = await alert_clinician.ainvoke(
                {
                    "reason": f"Test reason for {urgency}",
                    "urgency": urgency,
                }
            )
            assert isinstance(result, str)

        db_result = await db_session.execute(
            select(Alert).where(Alert.patient_id == patient.id)
        )
        alerts = db_result.scalars().all()
        assert len(alerts) == 3

    async def test_alert_clinician_defaults_to_normal_urgency(self, db_session: AsyncSession):
        patient = await _create_patient(db_session, external_id="tool-pat-ac3")
        tools = make_coach_tools(db_session, patient.id)
        alert_clinician = next(t for t in tools if t.name == "alert_clinician")

        result = await alert_clinician.ainvoke(
            {"reason": "Minor concern noted"}
        )
        assert isinstance(result, str)

        db_result = await db_session.execute(
            select(Alert).where(Alert.patient_id == patient.id)
        )
        alert = db_result.scalar_one()
        assert alert.urgency == AlertUrgency.NORMAL


# ---------------------------------------------------------------------------
# LangGraph ToolNode registration
# ---------------------------------------------------------------------------


class TestToolNodeRegistration:
    async def test_tools_register_with_tool_node(self, db_session):
        patient = await _create_patient(db_session, external_id="tool-tn-1")
        tools = make_coach_tools(db_session, patient.id)
        node = ToolNode(tools)
        assert node is not None

    async def test_tool_node_has_all_tools(self, db_session):
        patient = await _create_patient(db_session, external_id="tool-tn-2")
        tools = make_coach_tools(db_session, patient.id)
        ToolNode(tools)  # verifies registration doesn't error
        tool_names = {t.name for t in tools}
        assert len(tool_names) == 6
