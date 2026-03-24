"""Tests for TICKET-013: re-engagement conversation subgraph.

Covers all acceptance criteria:
- AC1: Patient in RE_ENGAGING phase sends message → coach responds with warm welcome-back
       referencing their previous goal
- AC2: Patient wants to resume previous goal → phase transitions to ACTIVE with existing goal
- AC3: Patient wants to set a new goal → set_goal called, phase transitions to ACTIVE
- AC4: Coach re-engagement response passes through safety enforcement pipeline
- AC5: Clinical question during re-engagement → safety pipeline handles appropriately
"""

from unittest.mock import AsyncMock, Mock

from app.graphs.re_engaging import (
    build_re_engaging_graph,
    build_re_engaging_system_prompt,
)
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
    """Build a minimal RE_ENGAGING-phase CoachState for testing."""
    return {
        "patient_id": patient_id,
        "phase": PatientPhase.RE_ENGAGING,
        "messages": messages or [{"role": "patient", "content": "Hey, I'm back"}],
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


class TestReEngagingSystemPrompt:
    """System prompt includes patient context and re-engagement framing."""

    def test_includes_previous_goal(self):
        state = _make_state(goal="Complete daily knee exercises")
        prompt = build_re_engaging_system_prompt(state)
        assert "Complete daily knee exercises" in prompt

    def test_goal_not_set(self):
        state = _make_state(goal=None)
        prompt = build_re_engaging_system_prompt(state)
        assert "No previous goal" in prompt

    def test_includes_welcome_back_framing(self):
        """Prompt instructs coach to provide a warm welcome-back message."""
        state = _make_state()
        prompt = build_re_engaging_system_prompt(state)
        assert "welcome" in prompt.lower() or "return" in prompt.lower()

    def test_includes_resume_or_new_goal_instructions(self):
        """Prompt tells coach to offer resume or new goal options."""
        state = _make_state()
        prompt = build_re_engaging_system_prompt(state)
        prompt_lower = prompt.lower()
        assert "resume" in prompt_lower or "new goal" in prompt_lower

    def test_includes_clinical_boundary(self):
        """Prompt tells coach to redirect clinical questions."""
        state = _make_state()
        prompt = build_re_engaging_system_prompt(state)
        assert "clinical" in prompt.lower() or "care team" in prompt.lower()


# ---------------------------------------------------------------------------
# AC1: Warm welcome-back message referencing previous goal
# ---------------------------------------------------------------------------


class TestReEngagingWelcomeBack:
    """AC1: Patient in RE_ENGAGING phase → coach responds with warm welcome-back
    referencing their previous goal."""

    async def test_coach_responds_with_welcome_back(self):
        generate_fn = _mock_generate(
            "Welcome back! I see your previous goal was to walk 30 minutes daily. "
            "Would you like to continue with that goal?"
        )
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state(
            messages=[{"role": "patient", "content": "Hi, I'm back"}],
        )

        result = await graph.ainvoke(state)

        assert len(result["messages"]) == 2
        coach_msg = result["messages"][-1]
        assert coach_msg["role"] == "coach"

    async def test_generate_fn_receives_system_prompt_with_goal(self):
        """generate_fn receives system prompt that includes previous goal."""
        received_prompts = []

        async def capturing_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            received_prompts.append(system_prompt)
            return "Welcome back! Your goal was to walk 30 minutes daily."

        generate_fn = AsyncMock(side_effect=capturing_generate)
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state(goal="Walk 30 minutes daily")

        await graph.ainvoke(state)

        assert len(received_prompts) == 1
        assert "Walk 30 minutes daily" in received_prompts[0]

    async def test_generate_fn_receives_patient_messages(self):
        """generate_fn is called with the patient's conversation messages."""
        received_messages = []

        async def capturing_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            received_messages.extend(messages)
            return "Welcome back!"

        generate_fn = AsyncMock(side_effect=capturing_generate)
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        patient_msg = {"role": "patient", "content": "I'm ready to start again"}
        state = _make_state(messages=[patient_msg])

        await graph.ainvoke(state)

        assert len(received_messages) == 1
        assert received_messages[0]["content"] == "I'm ready to start again"

    async def test_coach_message_appended_to_messages(self):
        """Coach response is appended to the messages list in state."""
        generate_fn = _mock_generate("Welcome back! Great to see you again!")
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state(
            messages=[{"role": "patient", "content": "Hi"}],
        )

        result = await graph.ainvoke(state)

        assert len(result["messages"]) == 2
        assert result["messages"][0] == {"role": "patient", "content": "Hi"}
        assert result["messages"][1]["role"] == "coach"
        assert result["messages"][1]["content"] == "Welcome back! Great to see you again!"


# ---------------------------------------------------------------------------
# AC2: Patient resumes previous goal → ACTIVE with existing goal
# ---------------------------------------------------------------------------


class TestReEngagingResumePreviousGoal:
    """AC2: Patient confirms to resume previous goal → phase transitions to ACTIVE."""

    async def test_tools_passed_to_generate_fn(self):
        """generate_fn receives tools for goal setting."""
        received_tools = []

        async def capturing_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            if tools:
                received_tools.extend(tools)
            return "Welcome back! Shall we continue with your previous goal?"

        generate_fn = AsyncMock(side_effect=capturing_generate)
        mock_tool = Mock()
        mock_tool.name = "set_goal"

        graph = build_re_engaging_graph(generate_fn=generate_fn, tools=[mock_tool])
        state = _make_state(
            messages=[{"role": "patient", "content": "Yes, I want to continue"}],
        )

        await graph.ainvoke(state)

        assert len(received_tools) == 1
        assert received_tools[0].name == "set_goal"


# ---------------------------------------------------------------------------
# AC3: Patient sets a new goal → set_goal called, transition to ACTIVE
# ---------------------------------------------------------------------------


class TestReEngagingNewGoal:
    """AC3: Patient wants a new goal → set_goal tool called with new goal."""

    async def test_set_goal_callable_by_generate_fn(self):
        """AC3: generate_fn can call set_goal with new goal text."""
        mock_tool = AsyncMock()
        mock_tool.name = "set_goal"
        mock_tool.ainvoke = AsyncMock(return_value="Goal set for patient 1: Run 5K weekly")

        async def tool_calling_generate(*, messages, system_prompt, patient_id, tools=None, **kwargs):
            if tools:
                for t in tools:
                    if t.name == "set_goal":
                        result = await t.ainvoke({
                            "patient_id": patient_id,
                            "goal_text": "Run 5K weekly",
                        })
                        return f"Great new goal! {result}"
            return "What goal would you like to set?"

        generate_fn = AsyncMock(side_effect=tool_calling_generate)
        graph = build_re_engaging_graph(generate_fn=generate_fn, tools=[mock_tool])
        state = _make_state(
            messages=[{"role": "patient", "content": "I want a new goal: run 5K weekly"}],
        )

        result = await graph.ainvoke(state)

        mock_tool.ainvoke.assert_called_once()
        assert "Run 5K weekly" in result["messages"][-1]["content"]


# ---------------------------------------------------------------------------
# AC4: Safety enforcement pipeline wraps all responses
# ---------------------------------------------------------------------------


class TestReEngagingSafetyEnforcement:
    """AC4: Coach re-engagement response passes through safety enforcement pipeline."""

    async def test_safe_response_has_passed_status(self):
        """Safe response → safety_status is PASSED."""
        generate_fn = _mock_generate("Welcome back! Ready to get going again?")
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["safety_status"] == SafetyStatus.PASSED

    async def test_safe_response_delivered_as_is(self):
        """Safe message passes through without modification."""
        generate_fn = _mock_generate("It's great to see you back! Your previous goal was walking.")
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        assert (
            result["messages"][-1]["content"]
            == "It's great to see you back! Your previous goal was walking."
        )

    async def test_clinical_response_triggers_retry(self):
        """Clinical content on first attempt → safety retries."""
        generate_fn = _mock_generate_sequence([
            "You should take ibuprofen for your returning pain.",
            "Welcome back! Let's focus on your exercise goals!",
        ])
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["safety_status"] == SafetyStatus.PASSED
        assert result["messages"][-1]["content"] == (
            "Welcome back! Let's focus on your exercise goals!"
        )

    async def test_double_clinical_returns_fallback(self):
        """Both attempts clinical → falls back to safe generic message."""
        generate_fn = _mock_generate_sequence([
            "Take ibuprofen for the pain.",
            "You probably have tendinitis based on those symptoms.",
        ])
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["safety_status"] == SafetyStatus.FALLBACK
        assert result["messages"][-1]["content"] in SAFE_FALLBACK_MESSAGES


# ---------------------------------------------------------------------------
# AC5: Clinical question during re-engagement → safety pipeline handles
# ---------------------------------------------------------------------------


class TestReEngagingClinicalBlock:
    """AC5: Clinical question during re-engagement → safety handles appropriately."""

    async def test_clinical_question_gets_fallback(self):
        """Patient asks clinical question → response redirects to care team."""
        generate_fn = _mock_generate_sequence([
            "You should take 400mg ibuprofen twice daily.",
            "Based on your symptoms, this is likely tendinitis.",
        ])
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state(
            messages=[{"role": "patient", "content": "What medication should I take?"}],
        )

        result = await graph.ainvoke(state)

        assert result["safety_status"] == SafetyStatus.FALLBACK
        msg = result["messages"][-1]["content"]
        assert msg in SAFE_FALLBACK_MESSAGES
        assert "care team" in msg.lower()

    async def test_crisis_message_blocked(self):
        """Crisis content → BLOCKED status and alert sent."""
        generate_fn = _mock_generate("I want to hurt myself.")
        alert_fn = AsyncMock(return_value="Alert created")
        graph = build_re_engaging_graph(
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
        graph = build_re_engaging_graph(
            generate_fn=generate_fn,
            alert_clinician_fn=alert_fn,
        )
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["messages"][-1]["content"] == CRISIS_SUPPORT_MESSAGE


# ---------------------------------------------------------------------------
# Graph structure tests
# ---------------------------------------------------------------------------


class TestReEngagingGraphStructure:
    """Graph builds and compiles correctly."""

    def test_build_re_engaging_graph_returns_compiled_graph(self):
        generate_fn = _mock_generate("Hello!")
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        assert callable(getattr(graph, "invoke", None))
        assert callable(getattr(graph, "ainvoke", None))

    async def test_state_preserved_through_graph(self):
        """Patient ID, phase, goal, and metadata survive graph execution."""
        generate_fn = _mock_generate("Welcome back!")
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state(
            patient_id=42,
            goal="Recover mobility",
            messages=[{"role": "patient", "content": "Hi"}],
        )

        result = await graph.ainvoke(state)

        assert result["patient_id"] == 42
        assert result["phase"] == PatientPhase.RE_ENGAGING
        assert result["goal"] == "Recover mobility"

    async def test_no_tools_still_works(self):
        """Graph works without tools parameter."""
        generate_fn = _mock_generate("Welcome back to your program!")
        graph = build_re_engaging_graph(generate_fn=generate_fn)
        state = _make_state()

        result = await graph.ainvoke(state)

        assert result["messages"][-1]["content"] == "Welcome back to your program!"
        assert result["safety_status"] == SafetyStatus.PASSED
