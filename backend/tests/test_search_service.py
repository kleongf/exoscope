"""All transport tests use mock transports and dummy credentials."""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
import pytest

from exoscope.websearch import service
from tests.search_fixtures import response


@dataclass
class Transport:
    requests: list[httpx.Request] = field(default_factory=list[httpx.Request])
    body: Any = field(default_factory=response)
    status: int = 200
    error: Exception | None = None
    delay: float = 0
    options: dict[str, object] = field(default_factory=dict[str, object])
    headers: dict[str, str] = field(default_factory=dict[str, str])
    raw: bytes | None = None

    async def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        await asyncio.sleep(self.delay)
        if self.error:
            raise self.error
        if self.raw is not None:
            return httpx.Response(self.status, content=self.raw)
        return httpx.Response(self.status, json=self.body, headers=self.headers)


@pytest.fixture(autouse=True)
def mocked(monkeypatch: pytest.MonkeyPatch) -> Transport:
    transport = Transport()

    def factory(*, retries: int, trust_env: bool) -> httpx.MockTransport:
        transport.options = {"retries": retries, "trust_env": trust_env}
        return httpx.MockTransport(transport.handle)

    monkeypatch.setattr(service.httpx, "AsyncHTTPTransport", factory)
    monkeypatch.setenv("OPENAI_API_KEY", "dummy-openai-key")
    monkeypatch.delenv("OPENAI_SEARCH_MODEL", raising=False)
    return transport


def test_one_post_configuration_and_call_time_key(
    mocked: Transport,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "new-dummy-key")
    result = service.search_web("  water?  ")
    assert result.status == "ok"
    assert result.query == "water?"
    assert len(mocked.requests) == 1
    request = mocked.requests[0]
    assert request.method == "POST"
    assert str(request.url) == "https://api.openai.com/v1/responses"
    assert request.headers["authorization"] == "Bearer new-dummy-key"
    payload = json.loads(request.content)
    assert payload["input"] == "water?"
    assert payload["model"] == "gpt-4.1-mini"
    assert payload["tools"] == [{"type": "web_search", "search_context_size": "low"}]
    assert payload["include"] == ["web_search_call.action.sources"]
    assert payload["max_output_tokens"] == 200
    assert payload["stream"] is False
    assert payload["store"] is False
    assert "google" not in request.content.decode().lower()
    assert mocked.options == {"retries": 0, "trust_env": False}
    assert request.extensions["timeout"] == dict.fromkeys(
        ["connect", "read", "write", "pool"], 30.0
    )


@pytest.mark.parametrize("query", ["", " \n ", "a" * 1001, "a\x00b"])
def test_invalid_queries_make_no_request(query: str, mocked: Transport) -> None:
    assert service.search_web(query).status == "unavailable"
    assert mocked.requests == []


def test_maximum_trimmed_query_is_accepted(mocked: Transport) -> None:
    assert service.search_web("  " + "a" * 1000 + " ").status == "ok"
    assert len(mocked.requests) == 1


def test_search_model_comes_from_env(mocked: Transport, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_SEARCH_MODEL", "gpt-6-luna")
    service.search_web("water?")
    assert json.loads(mocked.requests[0].content)["model"] == "gpt-6-luna"


def test_no_key_is_honestly_unavailable(
    mocked: Transport,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENAI_API_KEY")
    result = service.search_web("water?")
    assert result.status == "unavailable"
    assert result.error == "Web search is unavailable: OPENAI_API_KEY is not configured."
    assert mocked.requests == []


@pytest.mark.parametrize("status", [301, 307, 400, 401, 403, 429, 500, 503])
def test_http_errors_and_redirects_are_honest_and_never_retried(
    mocked: Transport,
    status: int,
) -> None:
    mocked.status = status
    mocked.headers = {"Location": "https://other.example/redirect"}
    mocked.body = {"error": "secret provider body dummy-openai-key"}
    result = service.search_web("water?")
    assert result.status == "unavailable"
    assert result.sources == result.supports == []
    assert "secret" not in result.model_dump_json()
    assert "dummy-openai-key" not in result.model_dump_json()
    assert len(mocked.requests) == 1


@pytest.mark.parametrize(
    "error",
    [
        httpx.ConnectError("secret dummy-openai-key"),
        httpx.ReadTimeout("secret dummy-openai-key"),
        RuntimeError("secret dummy-openai-key"),
    ],
)
def test_transport_errors_never_leak_or_retry(mocked: Transport, error: Exception) -> None:
    mocked.error = error
    result = service.search_web("water?")
    assert result.status == "unavailable"
    assert "secret" not in result.model_dump_json()
    assert "dummy-openai-key" not in result.model_dump_json()
    assert len(mocked.requests) == 1


def test_overall_timeout_cancels_pending_request(
    mocked: Transport,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(service, "TIMEOUT_SECONDS", 0.03)
    mocked.delay = 1
    started = time.monotonic()
    result = service.search_web("water?")
    assert time.monotonic() - started < 0.5
    assert result.status == "unavailable"
    assert result.error and "timed out" in result.error
    assert len(mocked.requests) == 1


@pytest.mark.parametrize("body", [None, [], "invalid", {}, {"status": "failed"}])
def test_malformed_body_is_unavailable(mocked: Transport, body: Any) -> None:
    mocked.body = body
    assert service.search_web("water?").status == "unavailable"
    assert len(mocked.requests) == 1


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("status", "incomplete"),
        ("status", "in_progress"),
        ("error", {"message": "secret dummy-openai-key"}),
        ("incomplete_details", {"reason": "max_output_tokens"}),
        ("output", [None]),
        ("output", {}),
        ("output", []),
    ],
)
def test_incomplete_or_error_response_is_unavailable(
    mocked: Transport,
    field: str,
    value: Any,
) -> None:
    mocked.body[field] = value
    result = service.search_web("water?")
    assert result.status == "unavailable"
    assert "secret" not in result.model_dump_json()


@pytest.mark.parametrize("index", [0, 1])
def test_incomplete_search_or_message_is_unavailable(mocked: Transport, index: int) -> None:
    mocked.body["output"][index]["status"] = "in_progress"
    assert service.search_web("water?").status == "unavailable"


def test_no_completed_search_is_unavailable(mocked: Transport) -> None:
    mocked.body["output"].pop(0)
    assert service.search_web("water?").status == "unavailable"


def test_malformed_text_is_unavailable(mocked: Transport) -> None:
    mocked.body["output"][1]["content"][0]["text"] = None
    assert service.search_web("water?").status == "unavailable"


def test_active_event_loop_returns_unavailable_before_request(mocked: Transport) -> None:
    async def call() -> None:
        assert service.search_web("water?").status == "unavailable"

    asyncio.run(call())
    assert mocked.requests == []


def test_invalid_json_body_is_sanitized(mocked: Transport) -> None:
    mocked.raw = b"<html>secret dummy-openai-key</html>"
    result = service.search_web("water?")
    assert result.status == "unavailable"
    assert "secret" not in result.model_dump_json()
    assert "dummy-openai-key" not in result.model_dump_json()


def test_overall_timeout_cancels_a_slow_drip_body(
    mocked: Transport,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(service, "TIMEOUT_SECONDS", 0.04)
    closed: list[bool] = []

    class SlowBody(httpx.AsyncByteStream):
        async def __aiter__(self):
            for _ in range(100):
                await asyncio.sleep(0.01)
                yield b" "

        async def aclose(self) -> None:
            closed.append(True)

    async def handle(request: httpx.Request) -> httpx.Response:
        mocked.requests.append(request)
        return httpx.Response(200, stream=SlowBody())

    monkeypatch.setattr(mocked, "handle", handle)
    started = time.monotonic()
    result = service.search_web("water?")
    assert time.monotonic() - started < 0.5
    assert result.status == "unavailable"
    assert result.error and "timed out" in result.error
    assert len(mocked.requests) == 1
    assert closed == [True]


def test_provider_boundary_accepts_shared_evidence_without_provider_transport(
    mocked: Transport, monkeypatch: pytest.MonkeyPatch
) -> None:
    from tests.test_agent_web import evidence

    class FixtureProvider:
        async def search(self, query: str) -> service.WebSearchResult:
            return evidence(query)

    monkeypatch.setattr(service, "get_provider", lambda: FixtureProvider())
    result = service.search_web("  water?  ")
    assert result.status == "ok" and result.query == "water?"
    assert result.sources and result.supports
    assert mocked.requests == []
