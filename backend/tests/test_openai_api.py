"""The OpenAI boundary: key at call time, hardened client, and messages that never leak."""

import httpx
import pytest

from exoscope.openai_api import (
    OpenAIUnavailableError,
    agent_model,
    failure_message,
    openai_client,
    openai_key,
    search_model,
)


def test_no_key_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert openai_key() is None
    with (
        pytest.raises(OpenAIUnavailableError, match="OPENAI_API_KEY is not configured"),
        openai_client(httpx.Timeout(5.0)),
    ):
        pass


def test_client_is_hardened(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "  sk-test  ")
    with openai_client(httpx.Timeout(5.0)) as client:
        assert str(client.base_url) == "https://api.openai.com"
        assert client.headers["authorization"] == "Bearer sk-test"
        assert client.follow_redirects is False
        assert client.trust_env is False


def test_models_default_and_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_AGENT_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_SEARCH_MODEL", raising=False)
    assert agent_model() == "gpt-6-luna"
    assert search_model() == "gpt-4.1-mini"
    monkeypatch.setenv("OPENAI_AGENT_MODEL", " gpt-6.1-sol ")
    monkeypatch.setenv("OPENAI_SEARCH_MODEL", "gpt-6-luna")
    assert agent_model() == "gpt-6.1-sol"
    assert search_model() == "gpt-6-luna"


def status_error(status: int, body: dict[str, object]) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(status, json={**body, "secret": "sk-leak"}, request=request)
    return httpx.HTTPStatusError("boom sk-leak", request=request, response=response)


@pytest.mark.parametrize(
    ("status", "body", "expected"),
    [
        (
            429,
            {"error": {"code": "insufficient_quota"}},
            "The OpenAI account has no remaining quota",
        ),
        (429, {"error": {"code": "rate_limit_exceeded"}}, "rate limit was reached"),
        (503, {}, "servers returned an error (503)"),
        (401, {}, "rejected the API key"),
        (400, {"error": {"message": "sk-leak"}}, "rejected the request (400)"),
    ],
)
def test_failure_message_names_the_cause_without_the_body(
    status: int, body: dict[str, object], expected: str
) -> None:
    message = failure_message("The agent", status_error(status, body))
    assert expected in message
    assert "sk-leak" not in message and "api.openai.com" not in message


def test_timeout_and_unknown_failures() -> None:
    assert "took too long" in failure_message("The agent", httpx.ReadTimeout("sk-leak"))
    assert "took too long" in failure_message("Voice", TimeoutError())
    unknown = failure_message("The agent", RuntimeError("sk-leak"))
    assert unknown == "The agent could not complete this turn. Please ask again."
