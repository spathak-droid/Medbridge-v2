"""Coach service — orchestrates LangGraph graphs with LLM and tools.

This is the central service that the API endpoints call. It:
1. Loads patient state from DB
2. Builds the appropriate graph with LLM provider and tools
3. Invokes the graph
4. Persists the result (messages, goals, alerts)
5. Detects tool calls (e.g. set_goal) and attaches metadata for the frontend
"""

from __future__ import annotations

import json
import logging
import random
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.graphs.active import build_active_system_prompt
from app.graphs.onboarding import build_onboarding_system_prompt
from app.graphs.re_engaging import build_re_engaging_system_prompt
from app.graphs.router import build_router_graph
from app.graphs.state import CoachState
from app.models.conversation import Conversation
from app.models.enums import MessageRole, PatientPhase, SafetyClassification, SafetyStatus
from app.models.goal import Goal
from app.models.message import Message
from app.models.patient import Patient
from app.services.llm_provider import generate_llm_response, generate_llm_response_stream
from app.services.safety_classifier import SafetyClassifierService
from app.services.safety_pipeline import AUGMENTED_RETRY_INSTRUCTION, CRISIS_SUPPORT_MESSAGE, SAFE_FALLBACK_MESSAGES
from app.tools.coach_tools import make_coach_tools

logger = logging.getLogger(__name__)


async def _get_patient(session: AsyncSession, patient_id: int) -> Patient:
    result = await session.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise ValueError(f"Patient {patient_id} not found")
    return patient


async def _get_confirmed_goal(session: AsyncSession, patient_id: int) -> str | None:
    result = await session.execute(
        select(Goal)
        .where(Goal.patient_id == patient_id, Goal.confirmed == True)  # noqa: E712
        .order_by(Goal.created_at.desc())
    )
    goal = result.scalar_one_or_none()
    return goal.raw_text if goal else None


async def _get_conversation_messages(
    session: AsyncSession, conversation_id: int
) -> list[dict[str, Any]]:
    result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "role": m.role.value.lower(),
            "content": m.content,
            "has_tool_calls": bool(m.tool_calls),
        }
        for m in messages
    ]


# Constants for context management
CONVERSATION_TOKEN_BUDGET = 3000
MIN_RECENT_MESSAGES = 4


def _estimate_tokens(text: str) -> int:
    """Estimate token count using ~4 chars per token heuristic."""
    return len(text) // 4


def _truncate_conversation_messages(
    messages: list[dict[str, Any]],
    *,
    token_budget: int = CONVERSATION_TOKEN_BUDGET,
) -> list[dict[str, Any]]:
    """Truncate conversation messages to fit within a token budget.

    Pinning strategy:
    - Always keep the first message (establishes context)
    - Always keep messages with tool calls (goal setting, reminders)
    - Always keep the last MIN_RECENT_MESSAGES messages
    - Fill remaining budget from most-recent-first among unpinned
    - Prepend a system note if any messages were dropped

    Pure function — no side effects.
    """
    if not messages:
        return messages

    total_tokens = sum(_estimate_tokens(m.get("content", "")) for m in messages)
    if total_tokens <= token_budget:
        return messages

    n = len(messages)
    pinned_indices: set[int] = set()

    # Pin first message
    pinned_indices.add(0)

    # Pin messages with tool calls
    for i, m in enumerate(messages):
        if m.get("has_tool_calls"):
            pinned_indices.add(i)

    # Pin last MIN_RECENT_MESSAGES
    for i in range(max(0, n - MIN_RECENT_MESSAGES), n):
        pinned_indices.add(i)

    # Calculate budget used by pinned messages
    pinned_tokens = sum(
        _estimate_tokens(messages[i].get("content", ""))
        for i in pinned_indices
    )

    # Fill remaining budget from most-recent unpinned messages
    remaining_budget = token_budget - pinned_tokens
    unpinned = [i for i in range(n) if i not in pinned_indices]
    unpinned.reverse()  # most recent first

    included_indices: set[int] = set(pinned_indices)
    for i in unpinned:
        msg_tokens = _estimate_tokens(messages[i].get("content", ""))
        if remaining_budget >= msg_tokens:
            included_indices.add(i)
            remaining_budget -= msg_tokens

    # Build result in original order
    result = [messages[i] for i in sorted(included_indices)]

    # Prepend system note if messages were dropped
    if len(result) < n:
        result.insert(0, {
            "role": "system",
            "content": (
                "Earlier conversation history has been trimmed to preserve context. "
                "Key moments (goal setting, reminders) are preserved above."
            ),
        })

    return result


async def _find_latest_unconfirmed_goal(
    session: AsyncSession, patient_id: int
) -> Goal | None:
    """Find the most recent unconfirmed goal for a patient (just set by the LLM)."""
    result = await session.execute(
        select(Goal)
        .where(
            Goal.patient_id == patient_id,
            Goal.confirmed == False,  # noqa: E712
        )
        .order_by(Goal.created_at.desc())
    )
    return result.scalar_one_or_none()


def _build_goal_metadata(tool_results: list[dict[str, Any]], goal: Goal | None) -> dict[str, Any]:
    """Build message metadata from tool calls during this turn.

    Detects set_goal, get_program_summary, and get_adherence_summary tool calls
    and attaches card_type metadata so the frontend can render rich cards.
    """
    metadata: dict[str, Any] = {}

    for tr in tool_results:
        tool_name = tr.get("name", "")
        if tool_name == "set_goal" and goal is not None:
            metadata["goal_proposed"] = True
            metadata["goal_text"] = goal.raw_text
            metadata["goal_id"] = goal.id
            metadata["card_type"] = "goal"
        elif tool_name == "get_program_summary":
            metadata["card_type"] = "program"
        elif tool_name == "get_adherence_summary":
            metadata["card_type"] = "adherence"

    return metadata




async def run_coach_turn(
    session: AsyncSession,
    patient_id: int,
    conversation_id: int,
    user_message_content: str | None = None,
) -> Message:
    """Run a single coach turn through the LangGraph pipeline.

    1. Load patient state and conversation history
    2. If user_message_content is provided, add it to the conversation
    3. Build and invoke the appropriate phase subgraph
    4. Detect tool calls (set_goal) and build metadata for frontend
    5. Persist the coach response with tool_calls and metadata
    6. Return the coach Message
    """
    patient = await _get_patient(session, patient_id)
    goal_text = await _get_confirmed_goal(session, patient_id)

    # Get existing messages
    messages = await _get_conversation_messages(session, conversation_id)
    messages = _truncate_conversation_messages(messages)

    # Add the new patient message if provided
    if user_message_content:
        messages.append({"role": "patient", "content": user_message_content})

    # Build tools bound to this session and patient
    tools = make_coach_tools(session, patient_id)

    # Build alert function
    from app.models.alert import Alert
    from app.models.enums import AlertUrgency

    async def alert_clinician_fn(*, patient_id: int, reason: str, urgency: str):
        alert = Alert(
            patient_id=patient_id,
            reason=reason,
            urgency=AlertUrgency(urgency),
        )
        session.add(alert)
        await session.commit()

    # Build the router graph with real subgraphs and invoke
    router = build_router_graph(
        generate_fn=generate_llm_response,
        tools=tools,
        alert_clinician_fn=alert_clinician_fn,
    )

    state: CoachState = {
        "patient_id": patient_id,
        "phase": patient.phase,
        "messages": messages,
        "goal": goal_text,
        "tool_results": [],
        "safety_status": SafetyStatus.PASSED,
        "metadata": {},
    }

    result = await router.ainvoke(state)

    # Handle non-dispatchable phases (PENDING / DORMANT)
    if result.get("error"):
        raise ValueError(result["error"])
    if result.get("noop"):
        raise ValueError(f"No action for phase {patient.phase.value}")

    # Extract the coach response (last message in the result)
    result_messages = result.get("messages", [])
    coach_content = "I'm here to help with your exercise goals!"
    if result_messages:
        last_msg = result_messages[-1]
        if isinstance(last_msg, dict):
            coach_content = last_msg.get("content", coach_content)

    # Extract tool call log from graph result
    tool_results = result.get("tool_results", [])

    # Check if set_goal was called — if so, find the goal and build metadata
    latest_goal = await _find_latest_unconfirmed_goal(session, patient_id)
    metadata = _build_goal_metadata(tool_results, latest_goal)

    # Determine safety status
    safety_status = result.get("safety_status", SafetyStatus.PASSED)

    # Persist the coach message with tool calls and metadata
    coach_msg = Message(
        conversation_id=conversation_id,
        role=MessageRole.COACH,
        content=coach_content,
        safety_status=safety_status,
        tool_calls=tool_results if tool_results else None,
        created_at=datetime.now(timezone.utc),
    )
    session.add(coach_msg)
    await session.commit()
    await session.refresh(coach_msg)

    # Attach metadata for the API layer (not persisted in Message, sent in response)
    coach_msg._goal_metadata = metadata  # type: ignore[attr-defined]

    return coach_msg


def _build_system_prompt_for_phase(phase: PatientPhase, state: dict[str, Any]) -> str:
    """Build the system prompt for a given phase using the graph prompt builders."""
    if phase == PatientPhase.ONBOARDING:
        return build_onboarding_system_prompt(state)
    elif phase == PatientPhase.ACTIVE:
        return build_active_system_prompt(state)
    elif phase == PatientPhase.RE_ENGAGING:
        return build_re_engaging_system_prompt(state)
    else:
        raise ValueError(f"No system prompt for phase: {phase.value}")


async def run_coach_turn_stream(
    session: AsyncSession,
    patient_id: int,
    conversation_id: int,
    user_message_content: str | None = None,
) -> AsyncGenerator[str, None]:
    """Stream a coach turn, yielding SSE-formatted events.

    1. Load patient state, determine phase, build system prompt
    2. Stream tokens from LLM, yielding SSE token events
    3. After streaming, classify the full text for safety
    4. Detect tool calls (set_goal) and include metadata in done event
    5. Persist the final message and yield a done/safety_override event
    """
    patient = await _get_patient(session, patient_id)
    goal_text = await _get_confirmed_goal(session, patient_id)

    # Reject non-conversable phases explicitly
    if patient.phase == PatientPhase.PENDING:
        yield f"event: error\ndata: {json.dumps({'detail': 'Patient has not completed onboarding yet'})}\n\n"
        return
    if patient.phase == PatientPhase.DORMANT:
        yield f"event: error\ndata: {json.dumps({'detail': 'Patient is dormant. Waiting for re-engagement.'})}\n\n"
        return

    # Get existing messages
    messages = await _get_conversation_messages(session, conversation_id)
    messages = _truncate_conversation_messages(messages)

    # Add the new patient message if provided
    if user_message_content:
        messages.append({"role": "patient", "content": user_message_content})

    # Build state dict for prompt builders
    state: dict[str, Any] = {
        "patient_id": patient_id,
        "goal": goal_text,
        "phase": patient.phase,
        "messages": messages,
        "tool_results": [],
        "safety_status": SafetyStatus.PASSED,
        "metadata": {},
    }

    # Build tools bound to this session and patient
    tools = make_coach_tools(session, patient_id)
    tool_call_log: list[dict[str, Any]] = []

    # Build system prompt for the patient's current phase
    system_prompt = _build_system_prompt_for_phase(patient.phase, state)

    # Stream tokens from the LLM (with real tool calling support)
    full_text = ""
    try:
        async for token in generate_llm_response_stream(
            messages=messages,
            system_prompt=system_prompt,
            patient_id=patient_id,
            tools=tools,
            tool_call_log=tool_call_log,
        ):
            full_text += token
            token_event = f"event: token\ndata: {json.dumps({'content': token})}\n\n"
            yield token_event
    except Exception as e:
        logger.exception("LLM streaming failed")
        error_event = f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"
        yield error_event
        return

    # Check for goals set during this turn
    latest_goal = await _find_latest_unconfirmed_goal(session, patient_id)
    metadata = _build_goal_metadata(tool_call_log, latest_goal)

    # Run safety classification on the full accumulated text
    classifier = SafetyClassifierService(enable_llm_fallback=True)
    result = await classifier.classify(full_text)
    now = datetime.now(timezone.utc)

    if result.classification == SafetyClassification.SAFE:
        coach_msg = Message(
            conversation_id=conversation_id,
            role=MessageRole.COACH,
            content=full_text,
            safety_status=SafetyStatus.PASSED,
            tool_calls=tool_call_log if tool_call_log else None,
            created_at=now,
        )
        session.add(coach_msg)
        await session.commit()
        await session.refresh(coach_msg)

        done_data: dict[str, Any] = {
            "id": coach_msg.id,
            "role": "COACH",
            "content": coach_msg.content,
            "created_at": coach_msg.created_at.isoformat(),
        }
        if metadata:
            done_data["metadata"] = metadata
        yield f"event: done\ndata: {json.dumps(done_data)}\n\n"

    elif result.classification == SafetyClassification.CLINICAL_CONTENT:
        # Clinical content detected — retry with augmented prompt (non-streaming)
        logger.info(
            "Streaming: clinical content detected, retrying (patient_id=%s, patterns=%s)",
            patient_id, result.matched_patterns,
        )
        retry_prompt = system_prompt + "\n\n" + AUGMENTED_RETRY_INSTRUCTION
        try:
            retry_text = await generate_llm_response(
                messages=messages,
                system_prompt=retry_prompt,
                patient_id=patient_id,
            )
            retry_result = await classifier.classify(retry_text)
        except Exception:
            logger.exception("Streaming safety retry failed")
            retry_result = None
            retry_text = None

        if retry_result and retry_result.classification == SafetyClassification.SAFE:
            # Retry produced safe content — use it as override
            content = retry_text
            safety_status = SafetyStatus.PASSED
        else:
            # Retry also clinical or failed — use safe fallback
            content = random.choice(SAFE_FALLBACK_MESSAGES)
            safety_status = SafetyStatus.FALLBACK

        coach_msg = Message(
            conversation_id=conversation_id,
            role=MessageRole.COACH,
            content=content,
            safety_status=safety_status,
            tool_calls=tool_call_log if tool_call_log else None,
            created_at=now,
        )
        session.add(coach_msg)
        await session.commit()
        await session.refresh(coach_msg)

        override_data: dict[str, Any] = {
            "id": coach_msg.id,
            "role": "COACH",
            "content": coach_msg.content,
            "created_at": coach_msg.created_at.isoformat(),
        }
        if metadata:
            override_data["metadata"] = metadata
        yield f"event: safety_override\ndata: {json.dumps(override_data)}\n\n"

    elif result.classification == SafetyClassification.CRISIS:
        # Persist crisis support message
        coach_msg = Message(
            conversation_id=conversation_id,
            role=MessageRole.COACH,
            content=CRISIS_SUPPORT_MESSAGE,
            safety_status=SafetyStatus.BLOCKED,
            tool_calls=tool_call_log if tool_call_log else None,
            created_at=now,
        )
        session.add(coach_msg)

        # Alert clinician
        from app.models.alert import Alert
        from app.models.enums import AlertUrgency

        alert = Alert(
            patient_id=patient_id,
            reason=f"Crisis signal detected in streamed message: {full_text[:200]}",
            urgency=AlertUrgency.CRITICAL,
        )
        session.add(alert)
        await session.commit()
        await session.refresh(coach_msg)

        override_data = {
            "id": coach_msg.id,
            "role": "COACH",
            "content": coach_msg.content,
            "created_at": coach_msg.created_at.isoformat(),
        }
        yield f"event: safety_override\ndata: {json.dumps(override_data)}\n\n"
