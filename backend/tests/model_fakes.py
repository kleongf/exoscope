"""Responses-API-shaped model replies, so tool tests run without a live provider."""

import json
from collections.abc import Generator
from contextlib import contextmanager

import httpx
import pytest

Item = dict[str, object]


def call(tool_name: str = "load_system", call_id: str = "tool-id", /, **arguments: object) -> Item:
    """One function_call output item; arguments arrive JSON-encoded, as from the API."""
    return {
        "type": "function_call",
        "call_id": call_id,
        "name": tool_name,
        "arguments": json.dumps(arguments),
    }


def reasoning(item_id: str) -> Item:
    return {"type": "reasoning", "id": item_id, "encrypted_content": "enc", "summary": []}


def message(text: str) -> Item:
    return {
        "type": "message",
        "role": "assistant",
        "content": [{"type": "output_text", "text": text, "annotations": []}],
    }


def answer(*parts: Item | str) -> dict[str, object]:
    """A model response; plain strings become assistant text, dicts are output items."""
    return {"output": [message(p) if isinstance(p, str) else p for p in parts]}


def user_text(items: list[Item]) -> str:
    """The text of the first (user) input item the loop sent."""
    content = items[0]["content"]
    assert isinstance(content, str)
    return content


def outputs_for(items: list[Item]) -> list[Item]:
    return [i for i in items if i.get("type") == "function_call_output"]


def mock_responses(monkeypatch: pytest.MonkeyPatch, *replies: dict[str, object]) -> list[Item]:
    """Serve `replies` from POST /v1/responses through the real run_agent; return the bodies."""
    from exoscope.agent import loop

    bodies: list[Item] = []
    queue = iter(replies)

    def handle(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json=next(queue))

    @contextmanager
    def client(_: httpx.Timeout) -> Generator[httpx.Client]:
        transport = httpx.MockTransport(handle)
        with httpx.Client(base_url="https://api.openai.com", transport=transport) as c:
            yield c

    monkeypatch.setattr(loop, "openai_client", client)
    return bodies
