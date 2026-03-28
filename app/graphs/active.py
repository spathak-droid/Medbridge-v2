"""Active phase conversation subgraph — TICKET-010.

Handles ongoing patient-coach interactions after onboarding is complete.
The coach responds to patient messages with motivational support, references
their goal and adherence data, and can autonomously call tools
(get_adherence_summary, get_program_summary, set_reminder).

All generated messages pass through the safety enforcement pipeline.

Design:
- Single-node subgraph: generate_response → END
- generate_fn is an injectable LLM abstraction that handles tool calling
- Safety pipeline wraps every generated response (retry + fallback)
- System prompt includes patient goal and coaching guidelines
"""

from __future__ import annotations

from typing import Any, Callable

from langgraph.graph import END, StateGraph

from app.graphs.mi_guidelines import ACTIVE_MI_TIPS, MI_OARS_GUIDELINES
from app.graphs.state import CoachState
from app.services.safety_pipeline import run_safety_pipeline

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

ACTIVE_SYSTEM_PROMPT = (
    "You are a supportive rehabilitation coach helping a patient with their "
    "exercise program.\n\n"
    "Patient's confirmed goal: {goal}\n\n"
    "Guidelines:\n"
    "- Provide motivational support focused on exercise progress\n"
    "- Reference the patient's goal and adherence data when relevant\n"
    "- Use available tools to look up adherence data, program details, "
    "or set reminders\n"
    "- IMPORTANT: Goals and exercise programs are set by clinicians only. Do NOT "
    "change the patient's goal or exercise program. If the patient asks to change "
    "their goal, switch programs, or modify their exercises, politely explain that "
    "their exercise program and goals are managed by their clinician. Encourage them "
    "to message their care team directly using the Messages section to discuss any changes.\n"
    "- When discussing exercises, be specific about proper form, common mistakes, "
    "and what to feel. Reference the video guides in their program.\n"
    "- Never provide clinical advice, diagnoses, or medication recommendations\n"
    "- Redirect clinical questions to the patient's care team"
) + MI_OARS_GUIDELINES + ACTIVE_MI_TIPS

AUGMENTED_RETRY_INSTRUCTION = (
    "Your previous response contained clinical content. "
    "Rephrase focusing only on exercise motivation and support."
)


def build_active_system_prompt(state: CoachState) -> str:
    """Build system prompt with patient context for the active phase."""
    from datetime import datetime
    goal = state.get("goal") or "Not yet set"
    today = datetime.now().strftime("%A, %B %d, %Y")
    return ACTIVE_SYSTEM_PROMPT.format(goal=goal) + f"\n\nToday's date is {today}. Use this when scheduling reminders or referencing dates."


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------


def build_active_graph(
    *,
    generate_fn: Callable,
    tools: list | None = None,
    alert_clinician_fn: Callable | None = None,
):
    """Build and compile the active phase conversation subgraph.

    Args:
        generate_fn: Async callable for LLM response generation.
            Signature: async (*, messages, system_prompt, patient_id, tools=None) -> str
            The LLM autonomously decides when to call tools based on the message.
        tools: Optional list of LangGraph-compatible tools (get_adherence_summary,
            get_program_summary, set_reminder) passed through to generate_fn.
        alert_clinician_fn: Optional async callable for crisis clinician alerts.

    Returns:
        Compiled LangGraph StateGraph for the active phase.
    """
    bound_tools = tools

    async def generate_response(state: CoachState) -> dict[str, Any]:
        """Generate a coach response with safety enforcement."""
        system_prompt = build_active_system_prompt(state)
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
