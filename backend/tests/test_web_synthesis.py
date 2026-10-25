"""An unsuccessful Gemma synthesis must never fall back to provider prose or speech."""

import pytest
from google.genai import types

from exoscope.agent import loop, runner, turn
from exoscope.agent.models import TurnRequest
from exoscope.agent.tools import web_search
from exoscope.websearch.models import WebSearchResult
from tests.test_agent import answer, call, offline_system
from tests.test_agent_web import OVERCLAIM, QUESTION, evidence


@pytest.mark.parametrize("failure", ["empty", "no_candidates", "exception", "tool_limit"])
def test_unsuccessful_synthesis_retains_provider_evidence_without_speaking(
    monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    provider = evidence(QUESTION)
    provider.grounded_text = OVERCLAIM
    provider.supports[0].text = OVERCLAIM

    def search(_: str) -> WebSearchResult:
        return provider

    def forbidden_speech(_: str) -> None:
        pytest.fail("Failed Gemma synthesis reached TTS")

    def agent(text: str, current: str | None) -> loop.AgentResult:
        first = True

        def generate(_: list[types.Content]) -> types.GenerateContentResponse:
            nonlocal first
            if first:
                first = False
                if failure == "tool_limit":
                    return answer(
                        call("web_search", query=QUESTION),
                        *[call("compare", x="radius", y="mass") for _ in range(5)],
                    )
                return answer(call("web_search", query=QUESTION))
            if failure == "empty":
                return answer(types.Part(text="  "))
            if failure == "no_candidates":
                return types.GenerateContentResponse()
            raise RuntimeError("synthetic private provider failure")

        return runner.run_loop(text, current, generate)

    monkeypatch.setattr(loop, "load_system", offline_system)
    monkeypatch.setattr(web_search, "search_web", search)
    monkeypatch.setattr(turn, "run_agent", agent)
    monkeypatch.setattr(turn.voice, "synthesize", forbidden_speech)
    response = turn.handle_turn(TurnRequest(text=QUESTION, current_system="TRAPPIST-1"))
    assert response.error and response.reply_audio is None
    assert "Gemma could not synthesize a reply" in response.reply_text
    assert OVERCLAIM not in response.reply_text
    assert "private provider failure" not in response.reply_text
    assert response.data.web_search == provider
    assert response.data.system is not None
    assert response.steps[0].status == "completed"


def test_compare_and_web_synthesis_share_turn_without_replacing_archive_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from exoscope.compare import compare
    from tests.test_agent_web import SYNTHESIS

    system = offline_system("TRAPPIST-1")
    expected = compare([system], "radius", "insolation")
    monkeypatch.setattr(loop, "load_system", offline_system)
    monkeypatch.setattr(web_search, "search_web", evidence)
    responses = iter(
        [
            answer(call("compare", x="radius", y="insolation"), call("web_search", query=QUESTION)),
            answer(types.Part(text=SYNTHESIS)),
        ]
    )
    result = runner.run_loop(
        "Compare radii and irradiation, and discuss liquid water",
        "TRAPPIST-1",
        lambda _: next(responses),
    )
    assert result.error is None
    assert result.data.comparison == expected
    assert result.data.system == system
    assert result.ui_commands == []
    assert SYNTHESIS in result.reply_text
    assert [step.name for step in result.steps] == ["compare", "web_search"]
