"""Plain google-genai loop. Only typed catalog tools can supply archive data."""

import os
from collections.abc import Callable
from time import monotonic

from google import genai
from google.genai import types
from pydantic import ValidationError

from exoscope.agent.model_config import gemma_model
from exoscope.agent.models import ToolStep
from exoscope.agent.result import AgentResult
from exoscope.agent.tools.base import TOOL_ERRORS, ToolError
from exoscope.agent.tools.registry import TOOLS, declaration
from exoscope.catalog import CatalogError, load_system

__all__ = ["AgentResult", "declaration", "run_agent", "run_loop"]

MAX_TOOL_CALLS = 5
Generate = Callable[[list[types.Content]], types.GenerateContentResponse]
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
    "Source papers can differ between properties.Habitability is not established by this catalog. "
    "Only the tools you are given are implemented; never claim an action no tool performed. "
    "Give a short finding suitable for speech."
)


def _execute(call: types.FunctionCall, result: AgentResult) -> tuple[dict[str, object], str]:
    tool = TOOLS.get(call.name or "")
    try:
        if tool is None:
            raise ToolError(f"Unsupported tool call; available tools: {', '.join(TOOLS)}.")
        output = tool.invoke(call.args or {}, result)
    except ValidationError:
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


def _dispatch(call: types.FunctionCall, result: AgentResult) -> dict[str, object]:
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


def _contents(text: str, current_system: str | None, result: AgentResult) -> list[types.Content]:
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
            context = f"Current canonical System data: {system.model_dump_json()}"
    return [
        types.Content(role="user", parts=[types.Part(text=f"{INSTRUCTIONS}\n{context}\n{text}")])
    ]


def run_loop(text: str, current_system: str | None, generate: Generate) -> AgentResult:
    result = AgentResult()
    try:
        contents = _contents(text, current_system, result)
        _iterate(contents, generate, result)
    except CatalogError as exc:
        result.error = str(exc)
    except Exception:
        # Do not expose SDK exception bodies/URLs, which can contain credentials.
        message = "Gemma could not complete this turn. Its live tool path remains unverified."
        result.error = f"{result.error} {message}" if result.error else message
    if result.error:
        result.reply_text = result.error
    return result


def _iterate(contents: list[types.Content], generate: Generate, result: AgentResult) -> None:
    count = 0
    for _ in range(MAX_TOOL_CALLS + 1):
        response = generate(contents)
        candidates = response.candidates or []
        if not candidates or not candidates[0].content:
            raise ValueError("No model content")
        content = candidates[0].content
        assert content is not None
        parts = content.parts or []
        calls = [part.function_call for part in parts if part.function_call]
        if not calls:
            result.reply_text = "".join(
                part.text or "" for part in parts if not part.thought
            ).strip()
            if not result.reply_text:
                raise ValueError("No final answer")
            return
        contents.append(content)  # Preserve IDs and thought signatures verbatim.
        replies: list[types.Part] = []
        for call in calls:
            if count >= MAX_TOOL_CALLS:
                error = "Tool-call limit reached (5); remaining actions were not run."
                result.error = f"{result.error} {error}" if result.error else error
                return
            count += 1
            replies.append(
                types.Part(
                    function_response=types.FunctionResponse(
                        id=call.id, name=call.name or "unknown", response=_dispatch(call, result)
                    )
                )
            )
        contents.append(types.Content(role="tool", parts=replies))


def run_agent(text: str, current_system: str | None = None) -> AgentResult:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        error = "Gemma is unavailable: GEMINI_API_KEY (or GOOGLE_API_KEY) is not configured."
        return AgentResult(reply_text=error, error=error)
    try:
        model = gemma_model()
        with genai.Client(
            api_key=key,
            http_options=types.HttpOptions(
                timeout=30_000, retry_options=types.HttpRetryOptions(attempts=1)
            ),
        ) as client:

            def generate(contents: list[types.Content]) -> types.GenerateContentResponse:
                return client.models.generate_content(  # pyright: ignore[reportUnknownMemberType]
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        tools=[declaration()],
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                        max_output_tokens=1024,
                    ),
                )

            return run_loop(text, current_system, generate)
    except Exception:
        error = "Gemma could not start this turn. Its live tool path remains unverified."
        return AgentResult(reply_text=error, error=error)
