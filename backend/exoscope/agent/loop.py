"""OpenAI Responses API tool loop. Only typed catalog tools can supply archive data."""

import json
from collections.abc import Callable
from time import monotonic, sleep

import httpx
from pydantic import ValidationError

from exoscope.agent import brief
from exoscope.agent.models import ToolStep
from exoscope.agent.responses import FunctionCall, Item, final_text, function_calls, output_items
from exoscope.agent.result import AgentResult
from exoscope.agent.tools.base import TOOL_ERRORS, ToolError
from exoscope.agent.tools.registry import TOOLS, tool_definitions
from exoscope.catalog import CatalogError, load_system
from exoscope.openai_api import (
    OpenAIUnavailableError,
    agent_model,
    failure_message,
    openai_client,
)

__all__ = ["AgentResult", "run_agent", "run_loop", "tool_definitions"]

MAX_TOOL_CALLS = 5
TIMEOUT = httpx.Timeout(30.0, connect=5.0)
ATTEMPTS = 3  # retry server errors only, never 429s
Generate = Callable[[list[Item]], dict[str, object]]
INSTRUCTIONS = (
    "You are ExoScope, a student exoplanet research assistant. Only tool results supply "
    "archive measurements; never invent numbers or canonical names. Call load_system to open "
    "a System, or to get data needed for a question. Use the current canonical System when "
    "the question says these planets. Spoken 'Trappist One' refers to the archive hostname "
    "TRAPPIST-1; spoken 'TOI seven hundred' refers to TOI-700. These name aliases still require "
    "a successful archive lookup, and are never permission to invent data. Never produce SQL "
    "or code. Unknown/ambiguous names and "
    "tool errors must be acknowledged honestly; never claim a failed tool succeeded. Say missing "
    "when a Quantity has status missing (it has no value). Include units and Live versus dated "
    "Snapshot provenance in findings. "
    "Use compare to chart two properties for the current System's planets; it needs no "
    "load_system call first. Describe the chart only from its result. "
    "Use search_catalog to find planets across the whole archive. For every vague word in the "
    "request, choose a concrete filter, say aloud how you read it (for example: I'm reading "
    "small as radius under 2 Earth radii), and pass it in interpretations; loaded words like "
    "Earth-like or habitable always need a caveat that the catalog cannot establish them. "
    "Source papers can differ between properties.Habitability is not established by this catalog. "
    "Only the tools you are given are implemented; never claim an action no tool performed. "
    "Give a short finding suitable for speech."
)


def _execute(call: FunctionCall, result: AgentResult) -> tuple[dict[str, object], str]:
    tool = TOOLS.get(call.name)
    try:
        if tool is None:
            raise ToolError(f"Unsupported tool call; available tools: {', '.join(TOOLS)}.")
        output = tool.invoke(json.loads(call.arguments or "{}"), result)
    except (ValidationError, json.JSONDecodeError):
        error = f"Invalid {call.name} arguments."
    except TOOL_ERRORS as exc:
        error = str(exc)
    else:
        if result.error:
            result.warnings.append(
                f"An earlier tool request failed: {result.error} A later tool call succeeded."
            )
            result.error = None
        return output.payload, output.detail
    result.error = f"{result.error} {error}" if result.error else error
    return {"error": error}, error


def _dispatch(call: FunctionCall, result: AgentResult) -> dict[str, object]:
    started = monotonic()
    payload: dict[str, object] = {}
    detail = "Tool dispatch failed."
    try:
        payload, detail = _execute(call, result)
        return payload
    finally:
        failed = not payload or "error" in payload
        result.steps.append(
            ToolStep(
                id=f"tool-{len(result.steps) + 1}",
                name=call.name or "unknown",
                status="failed" if failed else "completed",
                detail=detail,
                elapsed_ms=(monotonic() - started) * 1000,
            )
        )


def _input(text: str, current_system: str | None, result: AgentResult) -> list[Item]:
    context = "No System is currently selected."
    if current_system is not None:
        # Re-fetch trusted archive data rather than accepting client numbers or a guessed name.
        try:
            system = load_system(current_system)
        except CatalogError:
            result.warnings.append(
                "Current System data is unavailable; a different System can still be opened."
            )
            context = (
                "Current System data could not be refreshed. Do not assume its measurements. "
                "Use load_system for the System requested in this turn."
            )
        else:
            result.data.system = system
            if system.provenance.mode == "snapshot":
                result.warnings.append("Live archive unavailable; using dated Snapshot data.")
            compact = json.dumps(brief.system(system), separators=(",", ":"), ensure_ascii=False)
            context = f"Current canonical System data: {compact}"
    return [{"role": "user", "content": f"{context}\n{text}"}]


def run_loop(text: str, current_system: str | None, generate: Generate) -> AgentResult:
    result = AgentResult()
    try:
        _iterate(_input(text, current_system, result), generate, result)
    except CatalogError as exc:
        result.error = str(exc)
    except Exception as exc:
        # Never expose provider bodies or URLs, which can contain credentials.
        message = failure_message("The agent", exc)
        result.error = f"{result.error} {message}" if result.error else message
    if result.error:
        result.reply_text = result.error
    return result


def _iterate(items: list[Item], generate: Generate, result: AgentResult) -> None:
    count = 0
    for _ in range(MAX_TOOL_CALLS + 1):
        output = output_items(generate(items))
        calls = function_calls(output)
        if not calls:
            result.reply_text = final_text(output)
            if not result.reply_text:
                raise ValueError("No final answer")
            return
        # Send every output item back verbatim: reasoning items must accompany their calls.
        items.extend(output)
        for call in calls:
            if count >= MAX_TOOL_CALLS:
                error = "Tool-call limit reached (5); remaining actions were not run."
                result.error = f"{result.error} {error}" if result.error else error
                return
            count += 1
            payload = _dispatch(call, result)
            items.append(
                {
                    "type": "function_call_output",
                    "call_id": call.call_id,
                    "output": json.dumps(payload),
                }
            )


def _post(client: httpx.Client, body: dict[str, object]) -> dict[str, object]:
    for attempt in range(ATTEMPTS):
        response = client.post("/v1/responses", json=body)
        if response.status_code >= 500 and attempt < ATTEMPTS - 1:
            sleep(0.5 * 2**attempt)
            continue
        response.raise_for_status()
        return response.json()
    raise AssertionError("unreachable")


def run_agent(text: str, current_system: str | None = None) -> AgentResult:
    try:
        with openai_client(TIMEOUT) as client:
            model = agent_model()
            tools = tool_definitions()

            def generate(items: list[Item]) -> dict[str, object]:
                return _post(
                    client,
                    {
                        "model": model,
                        "instructions": INSTRUCTIONS,
                        "input": items,
                        "tools": tools,
                        "max_output_tokens": 1024,
                        "store": False,
                        "include": ["reasoning.encrypted_content"],
                    },
                )

            return run_loop(text, current_system, generate)
    except OpenAIUnavailableError as exc:
        error = f"The agent is unavailable: {exc}"
        return AgentResult(reply_text=error, error=error)
