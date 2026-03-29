"""Tests for the main router graph — TICKET-005.

Covers all acceptance criteria:
- ONBOARDING phase → dispatches to onboarding subgraph
- ACTIVE phase → dispatches to active subgraph
- RE_ENGAGING phase → dispatches to re-engagement subgraph
- PENDING phase → returns error (onboarding not initiated)
- DORMANT phase with no new message → returns no-op
- CoachState includes required fields
- Consent gate is the first check
"""


from typing import Any

from app.graphs.router import build_router_graph
from app.graphs.state import CoachState
from app.models.enums import PatientPhase, SafetyStatus


class TestCoachStateSchema:
    """CoachState TypedDict has all required fields."""

    def test_has_patient_id(self):
        annotations = CoachState.__annotations__
        assert "patient_id" in annotations

    def test_has_phase(self):
        annotations = CoachState.__annotations__
        assert "phase" in annotations

    def test_has_messages(self):
        annotations = CoachState.__annotations__
        assert "messages" in annotations

    def test_has_goal(self):
        annotations = CoachState.__annotations__
        assert "goal" in annotations

    def test_has_tool_results(self):
        annotations = CoachState.__annotations__
        assert "tool_results" in annotations

    def test_has_safety_status(self):
        annotations = CoachState.__annotations__
        assert "safety_status" in annotations

    def test_has_metadata(self):
        annotations = CoachState.__annotations__
        assert "metadata" in annotations

    def test_can_instantiate_minimal(self):
        """CoachState can be created with required fields."""
        state: CoachState = {
            "patient_id": 1,
            "phase": PatientPhase.ONBOARDING,
            "messages": [],
            "goal": None,
            "tool_results": [],
            "safety_status": SafetyStatus.PASSED,
            "metadata": {},
        }
        assert state["patient_id"] == 1
        assert state["phase"] == PatientPhase.ONBOARDING


class TestRouterGraph:
    """Main router graph dispatches to the correct subgraph based on phase."""

    def _invoke(self, phase: PatientPhase, messages: list[Any] | None = None, consent_verified: bool = True) -> dict[str, Any]:
        graph = build_router_graph()
        state: CoachState = {
            "patient_id": 1,
            "phase": phase,
            "messages": messages or [],
            "goal": None,
            "tool_results": [],
            "safety_status": SafetyStatus.PASSED,
            "metadata": {},
            "consent_verified": consent_verified,
        }
        result: dict[str, Any] = graph.invoke(state)
        return result

    def test_onboarding_dispatches(self):
        """AC1: ONBOARDING phase → dispatches to onboarding subgraph."""
        result = self._invoke(PatientPhase.ONBOARDING)
        assert result["phase"] == PatientPhase.ONBOARDING
        assert result.get("dispatched_to") == "onboarding"

    def test_active_dispatches(self):
        """AC2: ACTIVE phase → dispatches to active subgraph."""
        result = self._invoke(PatientPhase.ACTIVE)
        assert result["phase"] == PatientPhase.ACTIVE
        assert result.get("dispatched_to") == "active"

    def test_re_engaging_dispatches(self):
        """AC3: RE_ENGAGING phase → dispatches to re-engagement subgraph."""
        result = self._invoke(PatientPhase.RE_ENGAGING)
        assert result["phase"] == PatientPhase.RE_ENGAGING
        assert result.get("dispatched_to") == "re_engaging"

    def test_pending_returns_error(self):
        """AC4: PENDING phase → returns error indicating onboarding not initiated."""
        result = self._invoke(PatientPhase.PENDING)
        assert result.get("error") is not None
        assert "onboarding" in result["error"].lower() or "not initiated" in result["error"].lower()

    def test_dormant_returns_noop(self):
        """AC5: DORMANT phase with no new message → returns no-op."""
        result = self._invoke(PatientPhase.DORMANT, messages=[])
        assert result.get("noop") is True

    def test_consent_blocked_returns_error(self):
        """Consent gate blocks interaction when safety_status is BLOCKED."""
        graph = build_router_graph()
        state: CoachState = {
            "patient_id": 1,
            "phase": PatientPhase.ACTIVE,
            "messages": [],
            "goal": None,
            "tool_results": [],
            "safety_status": SafetyStatus.BLOCKED,
            "metadata": {},
            "consent_verified": True,
        }
        result = graph.invoke(state)
        assert result.get("error") is not None
        assert "consent" in result["error"].lower() or "blocked" in result["error"].lower()

    def test_consent_not_verified_returns_error(self):
        """Consent gate blocks interaction when consent_verified is False."""
        result = self._invoke(PatientPhase.ACTIVE, consent_verified=False)
        assert result.get("error") is not None
        assert "consent" in result["error"].lower()

    def test_graph_is_compiled(self):
        """build_router_graph returns a compiled graph."""
        graph = build_router_graph()
        # CompiledGraph has an invoke method
        assert callable(getattr(graph, "invoke", None))

    def test_state_preserved_through_routing(self):
        """Patient ID and metadata survive routing."""
        graph = build_router_graph()
        state: CoachState = {
            "patient_id": 42,
            "phase": PatientPhase.ACTIVE,
            "messages": [{"role": "patient", "content": "hello"}],
            "goal": "recover mobility",
            "tool_results": [],
            "safety_status": SafetyStatus.PASSED,
            "metadata": {"source": "sms"},
            "consent_verified": True,
        }
        result = graph.invoke(state)
        assert result["patient_id"] == 42
        assert result["metadata"] == {"source": "sms"}
