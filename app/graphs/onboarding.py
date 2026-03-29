"""Onboarding phase conversation subgraph — TICKET-007.

Program introduction flow:
1. Welcome patient warmly
2. Look up and describe their assigned exercise program
3. Explain how the program works (frequency, exercises, what to expect)
4. Be encouraging and supportive

All generated messages pass through the safety enforcement pipeline.
"""

from __future__ import annotations

from typing import Any, Callable

from langgraph.graph import END, StateGraph

from app.graphs.coach_personas import get_coach_name, get_personality
from app.graphs.mi_guidelines import MI_OARS_GUIDELINES, ONBOARDING_MI_TIPS
from app.graphs.state import CoachState
from app.services.safety_pipeline import run_safety_pipeline

ONBOARDING_TASK_PROMPT = (
    "\nYour job is to:\n"
    "1. Welcome the patient warmly to CareArc — introduce yourself by name\n"
    "2. Use the get_program_summary tool to look up their assigned exercise program, "
    "then describe the exercises they'll be doing in an encouraging way\n"
    "3. Explain how the program works — the frequency, the exercises, and what to expect\n"
    "4. Be encouraging and supportive, helping them feel confident about getting started\n\n"
    "IMPORTANT: The patient's exercise program and goals are managed by their clinician. "
    "Do NOT set goals or try to change their program. "
    "If the patient asks about goals, changing exercises, or modifying their program, "
    "redirect them to their care team via the Messages section.\n\n"
    "If no program is found, tell the patient their clinician hasn't set up their exercise "
    "program yet and to check back later or message their care team.\n\n"
    "Guidelines:\n"
    "- Keep responses concise (2-3 sentences)\n"
    "- If the patient asks clinical questions (about symptoms, medication, diagnosis), "
    "redirect them to their care team\n"
    "- Never provide clinical advice, diagnoses, or medication recommendations\n"
    "- Focus on exercise adherence and motivation, not clinical outcomes"
)

AUGMENTED_RETRY_INSTRUCTION = (
    "Your previous response contained clinical content. "
    "Rephrase focusing only on welcoming the patient and introducing their exercise program."
)


def build_onboarding_system_prompt(state: CoachState) -> str:
    """Build system prompt with patient context for onboarding."""
    from datetime import datetime
    coach_mode = state.get("metadata", {}).get("coach_mode")
    personality = get_personality(coach_mode)
    prompt = personality + ONBOARDING_TASK_PROMPT + MI_OARS_GUIDELINES + ONBOARDING_MI_TIPS
    goal = state.get("goal")
    if goal:
        prompt += f"\n\nThe patient's current goal: {goal}"
    today = datetime.now().strftime("%A, %B %d, %Y")
    prompt += f"\n\nToday's date is {today}. Use this when scheduling reminders or referencing dates."
    return prompt


def build_onboarding_graph(
    *,
    generate_fn: Callable,
    tools: list | None = None,
    alert_clinician_fn: Callable | None = None,
):
    """Build and compile the onboarding phase conversation subgraph.

    Args:
        generate_fn: Async callable for LLM response generation.
            Signature: async (*, messages, system_prompt, patient_id, tools=None) -> str
        tools: Optional list of LangGraph-compatible tools (set_goal).
        alert_clinician_fn: Optional async callable for crisis clinician alerts.

    Returns:
        Compiled LangGraph StateGraph for the onboarding phase.
    """
    bound_tools = tools

    async def generate_response(state: CoachState) -> dict[str, Any]:
        """Generate a coach response with safety enforcement."""
        system_prompt = build_onboarding_system_prompt(state)
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
