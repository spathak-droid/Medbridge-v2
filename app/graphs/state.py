"""Graph state schema shared across all subgraphs — TICKET-005.

CoachState is the single TypedDict that flows through the main router
and every phase-specific subgraph.
"""

from typing import Any, NotRequired, TypedDict

from app.models.enums import PatientPhase, SafetyStatus


class CoachState(TypedDict):
    """Shared state schema for the coaching graph.

    Fields:
        patient_id:    DB id of the patient.
        phase:         Current lifecycle phase (determines routing).
        messages:      Conversation message list.
        goal:          Optional rehabilitation goal text.
        tool_results:  Results from tool invocations within subgraphs.
        safety_status: Outcome of the latest safety / consent check.
        metadata:      Bag for ancillary data (source channel, etc.).
        dispatched_to: Marker set by placeholder subgraph nodes.
        error:         Error description when routing cannot proceed.
        noop:          Flag indicating no action was taken.
    """

    patient_id: int
    phase: PatientPhase
    messages: list[dict[str, Any]]
    goal: str | None
    tool_results: list[dict[str, Any]]
    safety_status: SafetyStatus
    metadata: dict[str, Any]
    # Consent verification (set by service layer before graph invocation)
    consent_verified: NotRequired[bool]
    # Routing output markers (set by graph nodes, not required on input)
    dispatched_to: NotRequired[str | None]
    error: NotRequired[str | None]
    noop: NotRequired[bool | None]
