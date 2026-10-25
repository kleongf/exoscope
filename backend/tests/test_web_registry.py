"""Exercise the production entry point and per-turn policy isolation."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import MagicMock

import pytest
from google.genai import types

from exoscope.agent import loop, runner, turn
from exoscope.agent.models import TurnRequest
from exoscope.agent.result import AgentResult
from exoscope.agent.tools.base import ToolError
from exoscope.agent.tools.web_search import WEB_SEARCH
from exoscope.agent.web_policy import CURRENT_WEB_POLICY
from exoscope.voice.models import ReplyAudio
from tests.test_agent import answer, call, offline_system
from tests.test_agent_web import CLAIM, QUESTION, evidence


def test_production_turn_scopes_web_policy_and_cites_original_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-gemini-key")
    monkeypatch.setattr(loop, "load_system", offline_system)
    monkeypatch.setattr("exoscope.agent.tools.web_search.search_web", evidence)
    client = MagicMock()
    generate = client.return_value.__enter__.return_value.models.generate_content
    generate.side_effect = [
        answer(call("web_search", query=QUESTION)),
        answer(types.Part(text="An unsupported model rewrite.")),
    ]
    monkeypatch.setattr(loop.genai, "Client", client)

    def synthesize(text: str) -> ReplyAudio:
        assert f"According to science.nasa.gov, {CLAIM}" in text
        return ReplyAudio(data_base64="UklGRg==", mime_type="audio/wav")

    monkeypatch.setattr(turn.voice, "synthesize", synthesize)
    response = turn.handle_turn(TurnRequest(text=QUESTION, current_system="TRAPPIST-1"))
    assert response.error is None and response.reply_audio is not None
    assert response.data.web_search is not None and response.data.web_search.status == "ok"
    assert response.steps[0].name == "web_search" and response.steps[0].status == "completed"
    assert "unsupported model rewrite" not in response.reply_text
    assert CURRENT_WEB_POLICY.get() is None


def test_concurrent_turns_keep_original_question_and_attempt_budget_isolated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(loop, "load_system", offline_system)
    monkeypatch.setattr("exoscope.agent.tools.web_search.search_web", evidence)
    barrier = Barrier(2)

    def run(question: str) -> AgentResult:
        first = True

        def generate(_: list[types.Content]) -> types.GenerateContentResponse:
            nonlocal first
            if first:
                first = False
                barrier.wait(timeout=5)
                # Both model calls request external evidence. Only the original
                # student's question may decide whether that request is allowed.
                return answer(call("web_search", query=QUESTION))
            return answer(types.Part(text="Unsupported rewrite"))

        result = runner.run_loop(question, "TRAPPIST-1", generate)
        assert CURRENT_WEB_POLICY.get() is None
        return result

    with ThreadPoolExecutor(max_workers=2) as pool:
        for _ in range(2):
            water, radius = list(pool.map(run, [QUESTION, "What is planet e's radius?"]))
            assert water.error is None and water.data.web_search is not None
            assert radius.error is not None and radius.data.web_search is None
            assert "Missing archive values stay missing" in radius.reply_text
    assert CURRENT_WEB_POLICY.get() is None


def test_unscoped_tool_raises_honest_error_without_provider_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def forbidden(_: str) -> None:
        pytest.fail("Unscoped tool dispatched a provider request")

    monkeypatch.setattr("exoscope.agent.tools.web_search.search_web", forbidden)
    with pytest.raises(ToolError, match="active turn"):
        WEB_SEARCH.invoke({"query": QUESTION}, AgentResult())


def test_runner_resets_policy_after_unexpected_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(text: str, current_system: str | None) -> AgentResult:
        assert CURRENT_WEB_POLICY.get() is not None
        raise RuntimeError("synthetic failure")

    monkeypatch.setattr(loop, "run_agent", fail)
    with pytest.raises(RuntimeError, match="synthetic failure"):
        runner.run_agent(QUESTION)
    assert CURRENT_WEB_POLICY.get() is None
