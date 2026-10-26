"""The OpenAI Responses API boundary: request shape, retries, reasoning items, failures."""

import json
from collections.abc import Callable, Generator
from contextlib import contextmanager

import httpx
import pytest

from exoscope.agent import loop
from exoscope.catalog import System
from tests.model_fakes import Item, answer, call, outputs_for, reasoning
from tests.test_agent import offline_system, patch_catalog


@pytest.mark.parametrize(
    ("status", "expected"),
    [(429, "rate limit"), (500, "servers returned an error (500)"), (None, "could not complete")],
)
def test_provider_failures_explain_the_cause_without_provider_bodies(
    status: int | None, expected: str
) -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")

    def fail(_: list[Item]) -> dict[str, object]:
        if status is None:
            raise RuntimeError("secret-key-in-body https://example.invalid")
        response = httpx.Response(status, text="secret-key-in-body", request=request)
        raise httpx.HTTPStatusError("secret-key-in-body", request=request, response=response)

    result = loop.run_loop("Open TRAPPIST-1", None, fail)
    assert result.error is not None and expected in result.error
    assert "secret-key" not in result.error


def test_reasoning_items_are_sent_back_verbatim(monkeypatch: pytest.MonkeyPatch) -> None:
    patch_catalog(monkeypatch, offline_system)
    seen: list[list[Item]] = []
    replies = iter([answer(reasoning("rs_1"), call(name="TRAPPIST-1")), answer("Loaded.")])

    def generate(items: list[Item]) -> dict[str, object]:
        seen.append(list(items))
        return next(replies)

    assert loop.run_loop("Open TRAPPIST-1", None, generate).error is None
    assert reasoning("rs_1") in seen[1]
    assert [o["call_id"] for o in outputs_for(seen[1])] == ["tool-id"]


def test_unparseable_arguments_are_an_honest_tool_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def forbidden(_: str) -> System:
        pytest.fail("Malformed arguments reached the catalog")

    patch_catalog(monkeypatch, forbidden)
    bad: Item = {
        "type": "function_call",
        "call_id": "c",
        "name": "load_system",
        "arguments": "{oops",
    }
    replies = iter([answer(bad), answer("Sorry.")])
    result = loop.run_loop("Open it", None, lambda _: next(replies))
    assert result.steps[0].status == "failed"
    assert result.steps[0].detail == "Invalid load_system arguments."
    assert result.error == "Invalid load_system arguments."


def test_tools_are_declared_as_responses_functions() -> None:
    definitions = loop.tool_definitions()
    names = [d["name"] for d in definitions]
    assert "load_system" in names and "web_search" in names
    assert all(d["type"] == "function" and d["strict"] is False for d in definitions)
    assert all(isinstance(d["parameters"], dict) for d in definitions)


Handler = Callable[[httpx.Request], httpx.Response]


def mock_client(monkeypatch: pytest.MonkeyPatch, handle: Handler) -> None:
    @contextmanager
    def client(_: httpx.Timeout) -> Generator[httpx.Client]:
        transport = httpx.MockTransport(handle)
        with httpx.Client(base_url="https://api.openai.com", transport=transport) as c:
            yield c

    monkeypatch.setattr(loop, "openai_client", client)

    def no_wait(_: float) -> None:
        return None

    monkeypatch.setattr(loop, "sleep", no_wait)


def test_request_body_and_server_error_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_AGENT_MODEL", raising=False)
    bodies: list[dict[str, object]] = []
    statuses = iter([503, 200])

    def handle(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/responses"
        bodies.append(json.loads(request.content))
        return httpx.Response(next(statuses), json=answer("Hello."))

    mock_client(monkeypatch, handle)
    result = loop.run_agent("Hi")
    assert result.error is None and result.reply_text == "Hello."
    assert len(bodies) == 2
    body = bodies[1]
    assert body["model"] == "gpt-6-luna" and body["instructions"] == loop.INSTRUCTIONS
    assert body["store"] is False and body["include"] == ["reasoning.encrypted_content"]
    assert body["input"] == [{"role": "user", "content": "No System is currently selected.\nHi"}]


def test_rate_limit_is_not_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[int] = []

    def handle(_: httpx.Request) -> httpx.Response:
        sent.append(1)
        return httpx.Response(429, json={"error": {"code": "rate_limit_exceeded"}})

    mock_client(monkeypatch, handle)
    result = loop.run_agent("Hi")
    assert len(sent) == 1
    assert result.error is not None and "rate limit" in result.error
