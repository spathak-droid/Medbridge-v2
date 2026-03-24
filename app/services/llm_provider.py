"""LLM provider using OpenRouter (OpenAI-compatible API).

Provides the generate_fn callable expected by LangGraph subgraphs.
Supports real function-calling: the LLM can autonomously invoke tools,
receive results, and continue generating until it produces a text response.

Integrates Langfuse for observability when configured.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MAX_TOOL_ROUNDS = 5


def _get_config() -> dict[str, str]:
    api_key = os.environ.get("OPEN_ROUTER_API_KEY", "")
    model = os.environ.get("OPEN_ROUTER_MODEL", "anthropic/claude-haiku-4.5")
    return {"api_key": api_key, "model": model}


def _get_langfuse():
    """Return a Langfuse client if configured, else None."""
    try:
        secret = os.environ.get("LANGFUSE_SECRET_KEY")
        public = os.environ.get("LANGFUSE_PUBLIC_KEY")
        host = os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com")
        if secret and public:
            from langfuse import Langfuse
            return Langfuse(
                secret_key=secret,
                public_key=public,
                host=host,
            )
    except Exception as e:
        logger.debug("langfuse unavailable, tracing disabled: %s", e)
    return None


_langfuse_client = None
_langfuse_checked = False


def _langfuse():
    global _langfuse_client, _langfuse_checked
    if not _langfuse_checked:
        _langfuse_checked = True
        _langfuse_client = _get_langfuse()
    return _langfuse_client


# ---------------------------------------------------------------------------
# Tool conversion helpers
# ---------------------------------------------------------------------------


def _tools_to_openai_format(tools: list) -> list[dict]:
    """Convert LangChain @tool functions to OpenAI function-calling format."""
    openai_tools = []
    for t in tools:
        try:
            schema = t.get_input_schema().model_json_schema()
        except Exception:
            schema = {}

        # Extract properties and required, drop pydantic metadata
        properties = {}
        for key, prop in schema.get("properties", {}).items():
            clean = {k: v for k, v in prop.items() if k not in ("title",)}
            properties[key] = clean

        params: dict[str, Any] = {
            "type": "object",
            "properties": properties,
        }
        required = schema.get("required")
        if required:
            params["required"] = required

        openai_tools.append({
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description or "",
                "parameters": params,
            },
        })
    return openai_tools


async def _execute_tool_calls(
    tool_calls: list[dict],
    tools: list,
) -> list[dict[str, str]]:
    """Execute tool calls returned by the LLM and return tool-role messages."""
    tool_map = {t.name: t for t in tools}
    results = []
    for tc in tool_calls:
        fn_name = tc["function"]["name"]
        try:
            fn_args = json.loads(tc["function"]["arguments"])
        except (json.JSONDecodeError, KeyError):
            fn_args = {}

        tool_obj = tool_map.get(fn_name)
        if tool_obj is None:
            results.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": f"Error: unknown tool '{fn_name}'",
            })
            continue

        try:
            result = await tool_obj.ainvoke(fn_args)
            results.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": str(result),
            })
        except Exception as e:
            logger.warning("Tool %s failed: %s", fn_name, e)
            results.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": f"Error executing {fn_name}: {e}",
            })
    return results


# ---------------------------------------------------------------------------
# Message building helper
# ---------------------------------------------------------------------------


def _build_api_messages(
    messages: list[dict[str, Any]],
    system_prompt: str,
) -> list[dict[str, str]]:
    """Convert conversation messages to OpenAI chat format."""
    api_messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
    ]
    for msg in messages:
        role = msg.get("role", "user").lower()
        if role in ("patient", "user"):
            api_role = "user"
        elif role in ("coach", "assistant"):
            api_role = "assistant"
        else:
            api_role = "user"
        api_messages.append({"role": api_role, "content": msg.get("content", "")})
    return api_messages


# ---------------------------------------------------------------------------
# Non-streaming generation (used by LangGraph subgraphs)
# ---------------------------------------------------------------------------


async def generate_llm_response(
    *,
    messages: list[dict[str, Any]],
    system_prompt: str,
    patient_id: int,
    tools: list | None = None,
    tool_call_log: list[dict[str, Any]] | None = None,
) -> str:
    """Generate a response via OpenRouter with autonomous tool calling.

    If the LLM decides to call tools, this function executes them and loops
    until the LLM produces a final text response (up to MAX_TOOL_ROUNDS).

    If tool_call_log is provided, each tool invocation is appended as
    {"name": ..., "args": ..., "result": ...} for audit purposes.
    """
    config = _get_config()
    api_messages = _build_api_messages(messages, system_prompt)
    openai_tools = _tools_to_openai_format(tools) if tools else None

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }

    # Langfuse tracing (best-effort, never breaks LLM flow)
    # HIPAA: Never send PHI to Langfuse — only metadata/counts
    lf = _langfuse()
    trace = None
    try:
        if lf:
            trace = lf.trace(
                name="coach-llm-call",
                metadata={"patient_id": patient_id},
                input={
                    "system_prompt_length": len(system_prompt),
                    "message_count": len(messages),
                    "message_roles": [m.get("role", "unknown") for m in messages],
                },
            )
    except Exception:
        pass

    last_content = ""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for _round in range(MAX_TOOL_ROUNDS + 1):
                body: dict[str, Any] = {
                    "model": config["model"],
                    "messages": api_messages,
                    "max_tokens": 1024,
                    "temperature": 0.7,
                }
                if openai_tools:
                    body["tools"] = openai_tools

                response = await client.post(
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers=headers,
                    json=body,
                )
                response.raise_for_status()
                data = response.json()

                choice = data["choices"][0]
                message = choice["message"]
                last_content = message.get("content") or ""

                # Log this LLM generation to Langfuse
                # HIPAA: Log only token counts and metadata to Langfuse, never message content
                try:
                    if trace:
                        usage = data.get("usage", {})
                        trace.generation(
                            name=f"llm-round-{_round}",
                            model=config["model"],
                            input={"message_count": len(api_messages)},
                            output={"content_length": len(last_content)},
                            usage={
                                "input": usage.get("prompt_tokens"),
                                "output": usage.get("completion_tokens"),
                                "total": usage.get("total_tokens"),
                            },
                            metadata={"round": _round, "has_tool_calls": bool(message.get("tool_calls"))},
                        )
                except Exception:
                    pass

                # If no tool calls, we're done — return the text
                if not message.get("tool_calls"):
                    break

                # LLM wants to call tools — execute them
                logger.info(
                    "LLM requesting %d tool call(s): %s",
                    len(message["tool_calls"]),
                    [tc["function"]["name"] for tc in message["tool_calls"]],
                )

                # Append the assistant message (with tool_calls) to context
                api_messages.append(message)

                # Execute tools and append results
                tool_results = await _execute_tool_calls(message["tool_calls"], tools)
                api_messages.extend(tool_results)

                # Log tool calls to Langfuse
                try:
                    if trace:
                        for tc, tr in zip(message["tool_calls"], tool_results):
                            trace.span(
                                name=f"tool-{tc['function']['name']}",
                                input=tc["function"]["arguments"],
                                output=tr["content"],
                                metadata={"tool_call_id": tc["id"]},
                            )
                except Exception:
                    pass

                # Log tool calls for audit trail
                if tool_call_log is not None:
                    for tc, tr in zip(message["tool_calls"], tool_results):
                        tool_call_log.append({
                            "name": tc["function"]["name"],
                            "args": tc["function"]["arguments"],
                            "result": tr["content"],
                        })
                # Loop back for the next LLM response

        # Finalize Langfuse trace
        try:
            if trace:
                trace.update(output={"response": last_content})
            if lf:
                lf.flush()
        except Exception:
            pass

        return last_content

    except Exception as e:
        logger.error("LLM call failed: %s", e)
        try:
            if trace:
                trace.update(output={"error": str(e)}, level="ERROR")
            if lf:
                lf.flush()
        except Exception:
            pass
        raise


# ---------------------------------------------------------------------------
# Streaming generation (used by SSE endpoint)
# ---------------------------------------------------------------------------


async def generate_llm_response_stream(
    *,
    messages: list[dict[str, Any]],
    system_prompt: str,
    patient_id: int,
    tools: list | None = None,
    tool_call_log: list[dict[str, Any]] | None = None,
) -> AsyncGenerator[str, None]:
    """Stream a response from OpenRouter, yielding content deltas.

    Handles tool calling: if the LLM requests tool calls during streaming,
    those rounds are executed silently (no tokens yielded) and the final
    text response is streamed to the caller.
    """
    config = _get_config()
    api_messages = _build_api_messages(messages, system_prompt)
    openai_tools = _tools_to_openai_format(tools) if tools else None

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }

    # Langfuse tracing (best-effort)
    lf = _langfuse()
    trace = None
    try:
        if lf:
            trace = lf.trace(
                name="coach-llm-stream",
                metadata={"patient_id": patient_id},
                input={
                    "system_prompt_length": len(system_prompt),
                    "message_count": len(messages),
                    "message_roles": [m.get("role", "unknown") for m in messages],
                },
            )
    except Exception:
        pass

    full_response = ""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            for _round in range(MAX_TOOL_ROUNDS + 1):
                body: dict[str, Any] = {
                    "model": config["model"],
                    "messages": api_messages,
                    "max_tokens": 1024,
                    "temperature": 0.7,
                    "stream": True,
                }
                if openai_tools:
                    body["tools"] = openai_tools

                # Accumulate tool calls from streamed deltas
                tool_calls_acc: dict[int, dict] = {}
                has_tool_calls = False

                async with client.stream(
                    "POST",
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers=headers,
                    json=body,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        if not line.startswith("data: "):
                            continue
                        payload = line[len("data: "):]
                        if payload.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(payload)
                        except json.JSONDecodeError:
                            continue
                        choices = chunk.get("choices", [])
                        if not choices:
                            continue
                        delta = choices[0].get("delta", {})

                        # Accumulate streamed tool call deltas
                        if delta.get("tool_calls"):
                            has_tool_calls = True
                            for tc_delta in delta["tool_calls"]:
                                idx = tc_delta["index"]
                                if idx not in tool_calls_acc:
                                    tool_calls_acc[idx] = {
                                        "id": tc_delta.get("id", ""),
                                        "type": "function",
                                        "function": {
                                            "name": "",
                                            "arguments": "",
                                        },
                                    }
                                if tc_delta.get("id"):
                                    tool_calls_acc[idx]["id"] = tc_delta["id"]
                                fn = tc_delta.get("function", {})
                                if fn.get("name"):
                                    tool_calls_acc[idx]["function"]["name"] = fn["name"]
                                if fn.get("arguments"):
                                    tool_calls_acc[idx]["function"]["arguments"] += fn["arguments"]

                        # Yield text content deltas to caller
                        content = delta.get("content")
                        if content:
                            full_response += content
                            yield content

                if has_tool_calls and tools:
                    # Execute the accumulated tool calls
                    tc_list = [tool_calls_acc[i] for i in sorted(tool_calls_acc)]
                    logger.info(
                        "Streaming: LLM requesting %d tool call(s): %s",
                        len(tc_list),
                        [tc["function"]["name"] for tc in tc_list],
                    )
                    api_messages.append({
                        "role": "assistant",
                        "tool_calls": tc_list,
                    })
                    tool_results = await _execute_tool_calls(tc_list, tools)
                    api_messages.extend(tool_results)

                    # Log tool calls to Langfuse
                    try:
                        if trace:
                            for tc, tr in zip(tc_list, tool_results):
                                trace.span(
                                    name=f"tool-{tc['function']['name']}",
                                    input=tc["function"]["arguments"],
                                    output=tr["content"],
                                )
                    except Exception:
                        pass

                    # Log tool calls for audit trail
                    if tool_call_log is not None:
                        for tc, tr in zip(tc_list, tool_results):
                            tool_call_log.append({
                                "name": tc["function"]["name"],
                                "args": tc["function"]["arguments"],
                                "result": tr["content"],
                            })
                    # Loop to get next response (which will be streamed)
                else:
                    break  # Text was already streamed, we're done

        # Finalize Langfuse trace
        # HIPAA: Log only metadata to Langfuse, never message content
        try:
            if trace:
                trace.generation(
                    name="llm-stream-result",
                    model=config["model"],
                    input={"message_count": len(api_messages)},
                    output={"response_length": len(full_response)},
                )
                trace.update(output={"response_length": len(full_response)})
            if lf:
                lf.flush()
        except Exception:
            pass

    except Exception as e:
        logger.error("LLM streaming call failed: %s", e)
        try:
            if trace:
                trace.update(output={"error": str(e)}, level="ERROR")
            if lf:
                lf.flush()
        except Exception:
            pass
        raise
