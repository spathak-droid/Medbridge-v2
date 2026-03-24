"""Tests for TICKET-010: active phase conversation subgraph.

Covers all acceptance criteria:
- AC1: Patient in ACTIVE phase sends message → coach responds with motivational support
- AC2: Patient asks about progress → coach calls get_adherence_summary, references results
- AC3: Patient asks about exercises → coach calls get_program_summary, references results
- AC4: Patient asks to set reminder → coach calls set_reminder with parameters
- AC5: Coach response passes through safety enforcement pipeline before delivery
- AC6: Clinical question → safety pipeline blocks and redirects to care team
"""

from unittest.mock import AsyncMock, Mock

from app.graphs.active import build_active_graph, build_active_system_prompt
from app.graphs.state import CoachState
from app.models.enums import PatientPhase, SafetyStatus
from app.services.safety_pipeline import SAFE_FALLBACK_MESSAGES

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_state(
    *,
    patient_id: int = 1,
    messages: list | None = None,
    goal: str | None = "Walk 30 minutes daily",
    safety_status: SafetyStatus = SafetyStatus.PASSED,
) -> CoachState:
    """Build a minimal ACTIVE-phase CoachState for testing."""
    return {
        "patient_id": patient_id,
        "phase": PatientPhase.ACTIVE,
        "messages": messages or [{"role": "patient", "content": "Hello coach"}],
        "goal": goal,
        "tool_results": [],
        "safety_status": safety_status,
        "metadata": {},
    }


def _mock_generate(response: str) -> AsyncMock:
    """Create a mock generate_fn that always returns the given response."""
    async def _fn(*, messages, system_prompt, patient_id, tools=None, **kwargs):
        return response

    mock = AsyncMock(side_effect=_fn)
    return mock


def _mock_generate_sequence(responses: list[str]) -> AsyncMock:
    """Create a mock generate_fn returning successive responses (for safety retry)."""
    call_count = 0

    async def _fn(*, messages, system_prompt, patient_id, tools=None, **kwargs):
        nonlocal call_count
        idx = min(call_count, len(responses) - 1)
        call_count += 1
        return responses[idx]

    mock = AsyncMock(side_effect=_fn)
    return mock


# ---------------------------------------------------------------------------
# System prompt tests
# ---------------------------------------------------------------------------


class TestActiveSystemPrompt:
    """System prompt includes patient context."""

    def test_includes_patient_goal(self):
        state = _make_state(goal="Recover knee mobility")
        prompt = build_active_system_prompt(state)
        assert "Recover knee mobility" in prompt

    def test_goal_not_set(self):
        state = _make_state(goal=None)
        prompt = build_active_system_prompt(state)
        assert "Not yet set" in prompt

    def test_includes_coaching_guidelines(self):
        state = _make_state()
        prompt = build_active_system_prompt(state)
        assert "motivational" in prompt.lower() or "support" in prompt.lower()

    def test_includes_clinical_boundary(self):
        """Prompt tells coach to redirect clinical questions."""
        state = _make_state()
        prompt = build_active_system_prompt(state)
        assert "clinical" in prompt.lower() or "care team" in prompt.lower()


# ---------------------------------------------------------------------------
# AC1: Coach responds with motivational support
# ---------------------------------------------------------------------------


class TestActiveGraphMotivationalResponse:
    """AC1: Patient sends message → coach responds with motivational support."""

    async def test_coach_responds_to_patient_message(self):
        generate_fn = _mock_generate("Great job staying consistent with your exercises!")
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state(
            messages=[{"role": "patient", "content": "I did my exercises today"}],
        )

        result = await graph.ainvoke(state)

        assert len(result["messages"]) == 2
        coach_msg = result["messages"][-1]
        assert coach_msg["role"] == "coach"
        assert "exercises" in coach_msg["content"].lower()

    async def test_generate_fn_receives_patient_messages(self):
        """generate_fn is called with the patient's conversation messages."""
        received_messages = []

        async def capturing_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            received_messages.extend(messages)
            return "Keep up the great work!"

        generate_fn = AsyncMock(side_effect=capturing_generate)
        graph = build_active_graph(generate_fn=generate_fn)
        patient_msg = {"role": "patient", "content": "How am I doing?"}
        state = _make_state(messages=[patient_msg])

        await graph.ainvoke(state)

        assert len(received_messages) == 1
        assert received_messages[0]["content"] == "How am I doing?"

    async def test_generate_fn_receives_system_prompt_with_goal(self):
        """generate_fn receives system prompt that includes patient goal."""
        received_prompts = []

        async def capturing_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            received_prompts.append(system_prompt)
            return "You're making progress toward your goal!"

        generate_fn = AsyncMock(side_effect=capturing_generate)
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state(goal="Complete 10K steps daily")

        await graph.ainvoke(state)

        assert len(received_prompts) == 1
        assert "Complete 10K steps daily" in received_prompts[0]

    async def test_coach_message_appended_to_messages(self):
        """Coach response is appended to the messages list in state."""
        generate_fn = _mock_generate("You're doing amazing!")
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state(
            messages=[{"role": "patient", "content": "Hi"}],
        )

        result = await graph.ainvoke(state)

        assert len(result["messages"]) == 2
        assert result["messages"][0] == {"role": "patient", "content": "Hi"}
        assert result["messages"][1]["role"] == "coach"
        assert result["messages"][1]["content"] == "You're doing amazing!"


# ---------------------------------------------------------------------------
# AC2: Coach calls get_adherence_summary on progress question
# ---------------------------------------------------------------------------


class TestActiveGraphAdherenceTool:
    """AC2: Patient asks about progress → coach calls get_adherence_summary."""

    async def test_tools_passed_to_generate_fn(self):
        """generate_fn receives tools for autonomous calling."""
        received_tools = []

        async def capturing_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            if tools:
                received_tools.extend(tools)
            return "Your adherence is 76%!"

        generate_fn = AsyncMock(side_effect=capturing_generate)
        mock_tool = Mock()
        mock_tool.name = "get_adherence_summary"

        graph = build_active_graph(generate_fn=generate_fn, tools=[mock_tool])
        state = _make_state(
            messages=[{"role": "patient", "content": "How is my progress?"}],
        )

        await graph.ainvoke(state)

        assert len(received_tools) == 1
        assert received_tools[0].name == "get_adherence_summary"

    async def test_adherence_tool_callable_by_generate_fn(self):
        """AC2: generate_fn can call get_adherence_summary and reference results."""
        mock_tool = AsyncMock()
        mock_tool.name = "get_adherence_summary"
        mock_tool.ainvoke = AsyncMock(return_value='{"adherence_percentage": 76.2}')

        async def tool_calling_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            if tools:
                for t in tools:
                    if t.name == "get_adherence_summary":
                        result = await t.ainvoke({"patient_id": patient_id})
                        return f"Your adherence is at 76.2%! Based on: {result}"
            return "Keep working hard!"

        generate_fn = AsyncMock(side_effect=tool_calling_generate)
        graph = build_active_graph(generate_fn=generate_fn, tools=[mock_tool])
        state = _make_state(
            messages=[{"role": "patient", "content": "How am I doing?"}],
        )

        result = await graph.ainvoke(state)

        mock_tool.ainvoke.assert_called_once()
        assert "76.2" in result["messages"][-1]["content"]


# ---------------------------------------------------------------------------
# AC3: Coach calls get_program_summary on exercise question
# ---------------------------------------------------------------------------


class TestActiveGraphProgramTool:
    """AC3: Patient asks about exercises → coach calls get_program_summary."""

    async def test_program_tool_callable_by_generate_fn(self):
        """AC3: generate_fn can call get_program_summary and reference results."""
        mock_tool = AsyncMock()
        mock_tool.name = "get_program_summary"
        mock_tool.ainvoke = AsyncMock(return_value='{"program_name": "Knee Rehab"}')

        async def tool_calling_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            if tools:
                for t in tools:
                    if t.name == "get_program_summary":
                        result = await t.ainvoke({"patient_id": patient_id})
                        return f"Your program is Knee Rehab. Details: {result}"
            return "Keep doing your exercises!"

        generate_fn = AsyncMock(side_effect=tool_calling_generate)
        graph = build_active_graph(generate_fn=generate_fn, tools=[mock_tool])
        state = _make_state(
            messages=[{"role": "patient", "content": "What exercises should I do?"}],
        )

        result = await graph.ainvoke(state)

        mock_tool.ainvoke.assert_called_once()
        assert "Knee Rehab" in result["messages"][-1]["content"]


# ---------------------------------------------------------------------------
# AC4: Coach calls set_reminder
# ---------------------------------------------------------------------------


class TestActiveGraphReminderTool:
    """AC4: Patient asks to set reminder → coach calls set_reminder."""

    async def test_set_reminder_callable_by_generate_fn(self):
        """AC4: generate_fn can call set_reminder with appropriate parameters."""
        mock_tool = AsyncMock()
        mock_tool.name = "set_reminder"
        mock_tool.ainvoke = AsyncMock(return_value="Reminder set for 9am")

        async def tool_calling_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            if tools:
                for t in tools:
                    if t.name == "set_reminder":
                        result = await t.ainvoke({
                            "patient_id": patient_id,
                            "message": "Time for exercises!",
                            "scheduled_time": "2025-01-15T09:00:00Z",
                        })
                        return f"Done! {result}"
            return "I can help set reminders for you."

        generate_fn = AsyncMock(side_effect=tool_calling_generate)
        graph = build_active_graph(generate_fn=generate_fn, tools=[mock_tool])
        state = _make_state(
            messages=[{"role": "patient", "content": "Remind me at 9am to exercise"}],
        )

        result = await graph.ainvoke(state)

        mock_tool.ainvoke.assert_called_once()
        call_args = mock_tool.ainvoke.call_args[0][0]
        assert call_args["patient_id"] == 1
        coach_content = result["messages"][-1]["content"]
        assert "9am" in coach_content.lower() or "Reminder" in coach_content

    async def test_multiple_tools_available(self):
        """All three active-phase tools can be passed together."""
        tool_names_received = []

        async def capturing_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            if tools:
                tool_names_received.extend(t.name for t in tools)
            return "Here to help!"

        tools = []
        for name in ["get_adherence_summary", "get_program_summary", "set_reminder"]:
            t = Mock()
            t.name = name
            tools.append(t)

        generate_fn = AsyncMock(side_effect=capturing_generate)
        graph = build_active_graph(generate_fn=generate_fn, tools=tools)
        state = _make_state()

        await graph.ainvoke(state)

        assert set(tool_names_received) == {
            "get_adherence_summary",
            "get_program_summary",
            "set_reminder",
        }


# ---------------------------------------------------------------------------
# AC5: Safety enforcement pipeline wraps all responses
# ---------------------------------------------------------------------------


class TestActiveGraphSafetyEnforcement:
    """AC5: Coach response passes through safety enforcement pipeline."""

    async def test_safe_response_has_passed_status(self):
        """Safe response → safety_status is PASSED."""
        generate_fn = _mock_generate("Keep stretching daily!")
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["safety_status"] == SafetyStatus.PASSED

    async def test_safe_response_delivered_as_is(self):
        """Safe message passes through without modification."""
        generate_fn = _mock_generate("Your 4-day streak is impressive!")
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["messages"][-1]["content"] == "Your 4-day streak is impressive!"

    async def test_clinical_response_triggers_retry(self):
        """Clinical content on first attempt → safety retries."""
        generate_fn = _mock_generate_sequence([
            "You should take ibuprofen for the pain.",
            "Keep focusing on your exercise routine!",
        ])
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        # Retry succeeded → safe response delivered
        assert result["safety_status"] == SafetyStatus.PASSED
        assert result["messages"][-1]["content"] == "Keep focusing on your exercise routine!"

    async def test_double_clinical_returns_fallback(self):
        """Both attempts clinical → falls back to safe generic message."""
        generate_fn = _mock_generate_sequence([
            "Take ibuprofen for the pain.",
            "You probably have tendinitis based on those symptoms.",
        ])
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["safety_status"] == SafetyStatus.FALLBACK
        assert result["messages"][-1]["content"] in SAFE_FALLBACK_MESSAGES


# ---------------------------------------------------------------------------
# AC6: Clinical question blocked and redirected to care team
# ---------------------------------------------------------------------------


class TestActiveGraphClinicalBlock:
    """AC6: Clinical question → safety blocks and redirects to care team."""

    async def test_clinical_question_gets_fallback(self):
        """Patient asks clinical question → response redirects to care team."""
        generate_fn = _mock_generate_sequence([
            "You should take 400mg ibuprofen twice daily.",
            "Based on your symptoms, this is likely tendinitis.",
        ])
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state(
            messages=[{"role": "patient", "content": "What medication should I take?"}],
        )

        result = await graph.ainvoke(state)

        assert result["safety_status"] == SafetyStatus.FALLBACK
        # Fallback messages redirect to care team
        msg = result["messages"][-1]["content"]
        assert msg in SAFE_FALLBACK_MESSAGES
        assert "care team" in msg.lower()

    async def test_crisis_message_blocked(self):
        """Crisis content → BLOCKED status and alert sent."""
        generate_fn = _mock_generate("I want to hurt myself.")
        alert_fn = AsyncMock(return_value="Alert created")
        graph = build_active_graph(
            generate_fn=generate_fn,
            alert_clinician_fn=alert_fn,
        )
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["safety_status"] == SafetyStatus.BLOCKED
        alert_fn.assert_called_once()
        call_kwargs = alert_fn.call_args[1]
        assert call_kwargs["urgency"] == "CRITICAL"

    async def test_crisis_delivers_support_message(self):
        """Crisis → patient receives crisis support message, not coach text."""
        from app.services.safety_pipeline import CRISIS_SUPPORT_MESSAGE

        generate_fn = _mock_generate("I don't want to live anymore.")
        alert_fn = AsyncMock(return_value="Alert created")
        graph = build_active_graph(
            generate_fn=generate_fn,
            alert_clinician_fn=alert_fn,
        )
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["messages"][-1]["content"] == CRISIS_SUPPORT_MESSAGE


# ---------------------------------------------------------------------------
# Graph structure tests
# ---------------------------------------------------------------------------


class TestActiveGraphStructure:
    """Graph builds and compiles correctly."""

    def test_build_active_graph_returns_compiled_graph(self):
        generate_fn = _mock_generate("Hello!")
        graph = build_active_graph(generate_fn=generate_fn)
        assert callable(getattr(graph, "invoke", None))
        assert callable(getattr(graph, "ainvoke", None))

    async def test_state_preserved_through_graph(self):
        """Patient ID, phase, goal, and metadata survive graph execution."""
        generate_fn = _mock_generate("Great work!")
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state(
            patient_id=42,
            goal="Recover mobility",
            messages=[{"role": "patient", "content": "Hi"}],
        )

        result = await graph.ainvoke(state)

        assert result["patient_id"] == 42
        assert result["phase"] == PatientPhase.ACTIVE
        assert result["goal"] == "Recover mobility"

    async def test_no_tools_still_works(self):
        """Graph works without tools parameter."""
        generate_fn = _mock_generate("You're doing great!")
        graph = build_active_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["messages"][-1]["content"] == "You're doing great!"
        assert result["safety_status"] == SafetyStatus.PASSED
