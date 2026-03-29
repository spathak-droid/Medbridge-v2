"""Main router graph with phase-based dispatching — TICKET-005.

Reads the patient's current phase from CoachState and dispatches to the
appropriate phase-specific subgraph node. The router contains no LLM logic
— it reads state and routes.

Consent gate is the first node: verifies the patient has logged in and
consented to outreach before any coach interaction proceeds.
"""

from typing import Callable

from langgraph.graph import END, StateGraph

from app.graphs.state import CoachState
from app.models.enums import PatientPhase, SafetyStatus

# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------

def consent_gate(state: CoachState) -> dict:
    """First node — block if patient has not met consent requirements.

    Checks the consent_verified flag set by the service layer (which reads
    Patient.logged_in and Patient.consent_given from the DB). Also blocks
    if safety_status is BLOCKED.
    """
    if state["safety_status"] == SafetyStatus.BLOCKED:
        return {"error": "Blocked: patient has not passed consent gate"}
    if not state.get("consent_verified", False):
        return {"error": "Blocked: patient has not logged in or consented to outreach"}
    return {}


def route_phase(state: CoachState) -> str:
    """Conditional edge: pick the next node based on patient phase."""
    if state.get("error"):
        return "end"
    phase = state["phase"]
    if phase == PatientPhase.PENDING:
        return "handle_pending"
    if phase == PatientPhase.ONBOARDING:
        return "onboarding_subgraph"
    if phase == PatientPhase.ACTIVE:
        return "active_subgraph"
    if phase == PatientPhase.RE_ENGAGING:
        return "re_engaging_subgraph"
    if phase == PatientPhase.DORMANT:
        return "handle_dormant"
    return "end"


# --- Placeholder subgraph nodes (real implementations in TICKET-007/010/013) ---

def onboarding_subgraph(state: CoachState) -> dict:
    """Placeholder: returns marker value for onboarding subgraph."""
    return {"dispatched_to": "onboarding"}


def active_subgraph(state: CoachState) -> dict:
    """Placeholder: returns marker value for active subgraph."""
    return {"dispatched_to": "active"}


def re_engaging_subgraph(state: CoachState) -> dict:
    """Placeholder: returns marker value for re-engagement subgraph."""
    return {"dispatched_to": "re_engaging"}


# --- Terminal phase handlers ---

def handle_pending(state: CoachState) -> dict:
    """PENDING phase — onboarding has not been initiated yet."""
    return {"error": "Onboarding has not been initiated for this patient"}


def handle_dormant(state: CoachState) -> dict:
    """DORMANT phase with no new message — no-op."""
    return {"noop": True}


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_router_graph(
    *,
    generate_fn: Callable | None = None,
    tools: list | None = None,
    alert_clinician_fn: Callable | None = None,
):
    """Construct and compile the main router StateGraph.

    When generate_fn is provided, subgraph nodes build and invoke real
    phase-specific graphs. Without it, placeholder stubs are used (for testing).

    Returns a compiled graph ready to be invoked with a CoachState dict.
    """
    if generate_fn is not None:
        from app.graphs.active import build_active_graph
        from app.graphs.onboarding import build_onboarding_graph
        from app.graphs.re_engaging import build_re_engaging_graph

        async def _onboarding_node(state: CoachState) -> dict:
            g = build_onboarding_graph(
                generate_fn=generate_fn, tools=tools,
                alert_clinician_fn=alert_clinician_fn,
            )
            return await g.ainvoke(state)

        async def _active_node(state: CoachState) -> dict:
            g = build_active_graph(
                generate_fn=generate_fn, tools=tools,
                alert_clinician_fn=alert_clinician_fn,
            )
            return await g.ainvoke(state)

        async def _re_engaging_node(state: CoachState) -> dict:
            g = build_re_engaging_graph(
                generate_fn=generate_fn, tools=tools,
                alert_clinician_fn=alert_clinician_fn,
            )
            return await g.ainvoke(state)
    else:
        _onboarding_node = onboarding_subgraph
        _active_node = active_subgraph
        _re_engaging_node = re_engaging_subgraph

    graph = StateGraph(CoachState)

    # Add nodes
    graph.add_node("consent_gate", consent_gate)
    graph.add_node("onboarding_subgraph", _onboarding_node)
    graph.add_node("active_subgraph", _active_node)
    graph.add_node("re_engaging_subgraph", _re_engaging_node)
    graph.add_node("handle_pending", handle_pending)
    graph.add_node("handle_dormant", handle_dormant)

    # Entry point
    graph.set_entry_point("consent_gate")

    # Conditional routing after consent gate
    graph.add_conditional_edges(
        "consent_gate",
        route_phase,
        {
            "onboarding_subgraph": "onboarding_subgraph",
            "active_subgraph": "active_subgraph",
            "re_engaging_subgraph": "re_engaging_subgraph",
            "handle_pending": "handle_pending",
            "handle_dormant": "handle_dormant",
            "end": END,
        },
    )

    # All terminal nodes go to END
    graph.add_edge("onboarding_subgraph", END)
    graph.add_edge("active_subgraph", END)
    graph.add_edge("re_engaging_subgraph", END)
    graph.add_edge("handle_pending", END)
    graph.add_edge("handle_dormant", END)

    return graph.compile()
