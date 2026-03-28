"""Onboarding phase conversation subgraph — TICKET-007.

Multi-turn onboarding flow:
1. Welcome patient, reference assigned exercises
2. Elicit an exercise goal (open-ended)
3. Extract structured goal from response
4. Confirm the goal with the patient
5. Store the confirmed goal

Handles edge cases: unrealistic goals, refusal to commit, clinical
questions mid-flow, and patient non-response.

All generated messages pass through the safety enforcement pipeline.
"""

from __future__ import annotations

from typing import Any, Callable

from langgraph.graph import END, StateGraph

from app.graphs.mi_guidelines import MI_OARS_GUIDELINES, ONBOARDING_MI_TIPS
from app.graphs.state import CoachState
from app.services.safety_pipeline import run_safety_pipeline

ONBOARDING_SYSTEM_PROMPT = (
    "You are a supportive rehabilitation coach onboarding a new patient.\n\n"
    "Your job is to guide the patient through these steps:\n"
    "1. Welcome the patient warmly\n"
    "2. Use the get_program_summary tool to look up their assigned exercise program, "
    "then describe the exercises they'll be doing in an encouraging way\n"
    "3. Help them set a specific, achievable exercise goal based on their program\n"
    "4. When they agree to a goal, use the set_goal tool to save it WITH ALL "
    "detail fields filled in:\n"
    "   - goal_text: The specific goal (e.g. 'Complete knee rehab exercises 5 days a week "
    "for 20 minutes')\n"
    "   - instructions: Numbered step-by-step instructions on how to achieve this goal safely. "
    "Include warm-up, technique tips, and progression advice (at least 4-5 steps).\n"
    "   - precautions: Safety warnings and when to seek medical attention. Include specific "
    "warning signs like sharp pain, swelling, dizziness, numbness. Always end with "
    "'Contact your care team immediately if symptoms persist.'\n"
    "   - video_url: A relevant YouTube video URL for the exercise type. Use real, well-known "
    "physical therapy YouTube channels like Bob & Brad, AskDoctorJo, or PhysioTutors. "
    "Provide the full URL.\n"
    "   - video_title: A descriptive title for the video.\n\n"
    "IMPORTANT: The patient's exercise program has already been assigned by their clinician. "
    "Do NOT try to change or reassign their program. If no program is found, tell the patient "
    "their clinician hasn't set up their exercise program yet and to check back later or "
    "message their care team.\n\n"
    "Guidelines:\n"
    "- Be warm, encouraging, and conversational\n"
    "- Keep responses concise (2-3 sentences)\n"
    "- If the patient gives an unrealistic goal (e.g., 'run a marathon tomorrow'), "
    "gently guide them toward something achievable\n"
    "- If the patient refuses to commit to a goal, acknowledge that and offer to "
    "revisit later — don't push\n"
    "- If the patient asks clinical questions (about symptoms, medication, diagnosis), "
    "redirect them to their care team\n"
    "- Never provide clinical advice, diagnoses, or medication recommendations\n"
    "- Focus on exercise adherence and motivation, not clinical outcomes"
) + MI_OARS_GUIDELINES + ONBOARDING_MI_TIPS

AUGMENTED_RETRY_INSTRUCTION = (
    "Your previous response contained clinical content. "
    "Rephrase focusing only on welcoming the patient and discussing exercise goals."
)


def build_onboarding_system_prompt(state: CoachState) -> str:
    """Build system prompt with patient context for onboarding."""
    from datetime import datetime
    goal = state.get("goal")
    prompt = ONBOARDING_SYSTEM_PROMPT
    if goal:
        prompt += f"\n\nThe patient has proposed this goal: {goal}\nConfirm it with them."
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
