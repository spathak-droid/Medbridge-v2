"""Re-engagement phase conversation subgraph — TICKET-013.

Handles warm re-engagement when a dormant patient returns. The coach
acknowledges the patient's return, references their previous goal,
and invites them to resume or set a new goal. Upon successful
re-engagement the patient transitions to ACTIVE.

Design:
- Single-node subgraph: generate_response → END
- generate_fn is an injectable LLM abstraction that handles tool calling
- Safety pipeline wraps every generated response (retry + fallback)
- System prompt includes previous goal and re-engagement framing
- Two paths: resume previous goal or set new goal via set_goal tool
"""

from __future__ import annotations

from typing import Any, Callable

from langgraph.graph import END, StateGraph

from app.graphs.mi_guidelines import MI_OARS_GUIDELINES, RE_ENGAGING_MI_TIPS
from app.graphs.state import CoachState
from app.services.safety_pipeline import run_safety_pipeline

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

RE_ENGAGING_SYSTEM_PROMPT = (
    "You are a supportive rehabilitation coach welcoming back a patient who "
    "has been away.\n\n"
    "Patient's previous goal: {goal}\n\n"
    "Guidelines:\n"
    "- Provide a warm welcome-back message acknowledging the patient's return\n"
    "- Reference their previous goal and ask if they'd like to resume it "
    "or set a new goal\n"
    "- If the patient wants to resume their previous goal, confirm and "
    "encourage them\n"
    "- If the patient wants a new goal, use the set_goal tool to record it\n"
    "- Never provide clinical advice, diagnoses, or medication recommendations\n"
    "- Redirect clinical questions to the patient's care team"
) + MI_OARS_GUIDELINES + RE_ENGAGING_MI_TIPS

AUGMENTED_RETRY_INSTRUCTION = (
    "Your previous response contained clinical content. "
    "Rephrase focusing only on welcoming the patient back and discussing goals."
)


def build_re_engaging_system_prompt(state: CoachState) -> str:
    """Build system prompt with patient context for the re-engaging phase."""
    from datetime import datetime
    goal = state.get("goal") or "No previous goal"
    today = datetime.now().strftime("%A, %B %d, %Y")
    return RE_ENGAGING_SYSTEM_PROMPT.format(goal=goal) + f"\n\nToday's date is {today}. Use this when scheduling reminders or referencing dates."


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------


def build_re_engaging_graph(
    *,
    generate_fn: Callable,
    tools: list | None = None,
    alert_clinician_fn: Callable | None = None,
):
    """Build and compile the re-engagement phase conversation subgraph.

    Args:
        generate_fn: Async callable for LLM response generation.
            Signature: async (*, messages, system_prompt, patient_id, tools=None) -> str
            The LLM autonomously decides when to call tools based on the message.
        tools: Optional list of LangGraph-compatible tools (set_goal) passed
            through to generate_fn.
        alert_clinician_fn: Optional async callable for crisis clinician alerts.

    Returns:
        Compiled LangGraph StateGraph for the re-engagement phase.
    """
    bound_tools = tools

    async def generate_response(state: CoachState) -> dict[str, Any]:
        """Generate a coach response with safety enforcement."""
        system_prompt = build_re_engaging_system_prompt(state)
        patient_id = state["patient_id"]
        messages = state["messages"]
        tool_call_log: list[dict[str, Any]] = []

        async def _generate(augmented_prompt: bool = False) -> str:
            prompt = system_prompt
            if augmented_prompt:
                prompt += "\n\n" + AUGMENTED_RETRY_INSTRUCTION
            result: str = await generate_fn(
                messages=messages,
                system_prompt=prompt,
                patient_id=patient_id,
                tools=bound_tools,
                tool_call_log=tool_call_log,
            )
            return result

        pipeline_result = await run_safety_pipeline(
            patient_id=patient_id,
            generate_fn=_generate,
            alert_clinician_fn=alert_clinician_fn,
        )

        coach_message: dict[str, Any] = {
            "role": "coach",
            "content": pipeline_result.message,
        }

        return {
            "messages": list(messages) + [coach_message],
            "safety_status": pipeline_result.safety_status,
            "tool_results": tool_call_log,
        }

    graph = StateGraph(CoachState)
    graph.add_node("generate_response", generate_response)
    graph.set_entry_point("generate_response")
    graph.add_edge("generate_response", END)

    return graph.compile()
