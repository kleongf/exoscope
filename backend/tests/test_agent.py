"""Responses-shaped replies exercise the manual tool boundary without a live provider."""

import json

import pytest

from exoscope.agent import brief, loop, turn
from exoscope.agent.tools import load_system as load_system_tool
from exoscope.catalog import CatalogError, CatalogUnavailableError, System, load_system
from exoscope.catalog.tap import Row
from exoscope.voice.models import ReplyAudio
from tests.model_fakes import Item, answer, call, outputs_for, user_text


def patch_catalog(monkeypatch: pytest.MonkeyPatch, load: object) -> None:
    """The loop refreshes current-System context; the load_system tool opens Systems."""
    monkeypatch.setattr(loop, "load_system", load)
    monkeypatch.setattr(load_system_tool, "load_system", load)


def offline_system(name: str) -> System:
    def unavailable(_: str) -> list[Row]:
        raise CatalogUnavailableError("Archive unavailable in offline test.")

    return load_system(name, tap=unavailable)


def test_tool_result_round_trip_and_validated_command(monkeypatch: pytest.MonkeyPatch) -> None:
    system = offline_system("TRAPPIST-1")

    def load(_: str) -> System:
        return system

    patch_catalog(monkeypatch, load)
    requests: list[list[Item]] = []

    def generate(items: list[Item]) -> dict[str, object]:
        requests.append(list(items))
        if len(requests) == 1:
            return answer(call(**{"name": "trappist-1"}))
        (output,) = outputs_for(items)
        assert output["call_id"] == "tool-id"
        assert isinstance(output["output"], str) and "system" in json.loads(output["output"])
        return answer("Loaded TRAPPIST-1 from the dated Snapshot.")

    result = loop.run_loop("Open TRAPPIST-1", None, generate)
    assert result.error is None
    assert result.ui_commands[0].kind == "load_system"
    assert result.data.system == system
    assert result.warnings
    assert requests[1][1]["type"] == "function_call"


def test_unknown_tool_error_retained_even_if_model_claims_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unknown(_: str) -> System:
        raise CatalogError("Unknown System name")

    patch_catalog(monkeypatch, unknown)
    replies = iter([answer(call(**{"name": "made up"})), answer("Loaded it.")])
    result = loop.run_loop("Open made up", None, lambda _: next(replies))
    assert result.error == "Unknown System name"
    assert result.ui_commands == []
    assert result.data.system is None


def test_five_call_limit_including_multiple_calls_per_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    executed: list[str] = []

    def load(name: str) -> System:
        executed.append(name)
        return offline_system("TRAPPIST-1")

    patch_catalog(monkeypatch, load)
    result = loop.run_loop(
        "Open TRAPPIST-1",
        None,
        lambda _: answer(*[call(**{"name": "TRAPPIST-1"}) for _ in range(8)]),
    )
    assert len(result.steps) == 5
    assert len(executed) == 5
    assert len(result.ui_commands) == 5
    assert result.error is not None and "limit" in result.error


def test_final_answer_allowed_after_fifth_call(monkeypatch: pytest.MonkeyPatch) -> None:
    patch_catalog(monkeypatch, offline_system)
    responses = iter(
        [answer(call(**{"name": "TRAPPIST-1"})) for _ in range(5)]
        + [answer("Loaded from Snapshot.")]
    )
    assert loop.run_loop("open", None, lambda _: next(responses)).error is None


def test_provider_failure_after_tool_retains_evidence(monkeypatch: pytest.MonkeyPatch) -> None:
    patch_catalog(monkeypatch, offline_system)
    responses = iter([answer(call(**{"name": "TRAPPIST-1"}))])
    result = loop.run_loop("open", None, lambda _: next(responses))
    assert result.error is not None and "could not complete" in result.error
    assert len(result.ui_commands) == 1
    assert result.data.system is not None


def test_current_system_is_refetched_and_canonicalized(monkeypatch: pytest.MonkeyPatch) -> None:
    patch_catalog(monkeypatch, offline_system)

    def generate(items: list[Item]) -> dict[str, object]:
        text = user_text(items)
        assert '"hostname":"TRAPPIST-1"' in text
        return answer("The catalog has seven planets in this System.")

    result = loop.run_loop("these?", " trappist- 1 ", generate)
    assert result.error is None and result.data.system is not None
    assert result.ui_commands == []
    assert result.steps == []


def test_unavailable_current_system_does_not_block_opening_another(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def load(name: str) -> System:
        if name == "Kepler-186":
            raise CatalogError("Live archive unavailable; current System absent from Snapshot.")
        return offline_system(name)

    patch_catalog(monkeypatch, load)
    responses = iter(
        [
            answer(call(**{"name": "TRAPPIST-1"})),
            answer("Opened TRAPPIST-1 from the dated Snapshot."),
        ]
    )
    result = loop.run_loop("Open TRAPPIST-1", "Kepler-186", lambda _: next(responses))
    assert result.error is None
    assert result.data.system is not None
    assert result.data.system.hostname == "TRAPPIST-1"
    assert len(result.ui_commands) == 1
    assert any("Current System data is unavailable" in warning for warning in result.warnings)


def test_no_key_returns_useful_safe_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    result = loop.run_agent("Open TRAPPIST-1")
    assert result.error == "The agent is unavailable: OPENAI_API_KEY is not configured."
    assert not result.ui_commands


@pytest.mark.parametrize(
    "tool_part",
    [call("execute_sql", sql="select * from pscomppars"), call(name="TRAPPIST-1", sql="ignored")],
)
def test_unlisted_tools_and_extra_arguments_never_execute(
    monkeypatch: pytest.MonkeyPatch, tool_part: Item
) -> None:
    def forbidden(_: str) -> System:
        pytest.fail("Invalid tool input reached catalog")

    patch_catalog(monkeypatch, forbidden)
    responses = iter([answer(tool_part), answer("Success.")])
    result = loop.run_loop("open", None, lambda _: next(responses))
    assert result.error is not None
    assert result.reply_text == result.error
    assert result.ui_commands == []


def test_recovered_catalog_failure_is_timed_and_allows_spoken_reply(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def load(name: str) -> System:
        if name == "Trappist One":
            raise CatalogError("Unknown System name")
        return offline_system(name)

    responses = iter(
        [
            answer(call(name="Trappist One")),
            answer(call(name="TRAPPIST-1")),
            answer("Opened TRAPPIST-1 from the dated Snapshot."),
        ]
    )
    clock = iter([10.0, 10.025, 20.0, 20.05])
    monkeypatch.setattr(loop, "monotonic", lambda: next(clock))
    patch_catalog(monkeypatch, load)

    def agent(text: str, current: str | None) -> loop.AgentResult:
        return loop.run_loop(text, current, lambda _: next(responses))

    def synthesize(_: str) -> ReplyAudio:
        return ReplyAudio(data_base64="UklGRg==", mime_type="audio/wav")

    monkeypatch.setattr(turn, "run_agent", agent)
    monkeypatch.setattr(turn.voice, "synthesize", synthesize)
    response = turn.handle_turn(turn.TurnRequest(text="Open Trappist One"))
    assert response.error is None
    assert response.reply_audio is not None
    assert any("Unknown System name" in warning for warning in response.warnings)
    assert [step.name for step in response.steps] == ["load_system", "load_system", "synthesize"]
    assert [step.status for step in response.steps] == ["failed", "completed", "completed"]
    assert [step.elapsed_ms for step in response.steps[:2]] == pytest.approx([25, 50])
    assert len({step.id for step in response.steps}) == 3
    assert response.steps[0].detail == "Unknown System name"
    assert response.steps[1].detail == "Loaded TRAPPIST-1."


@pytest.mark.parametrize("name", ["TRAPPIST-1", "TOI-700"])
def test_agent_receives_complete_canonical_snapshot_data(
    monkeypatch: pytest.MonkeyPatch, name: str
) -> None:
    patch_catalog(monkeypatch, offline_system)

    def generate(items: list[Item]) -> dict[str, object]:
        text = user_text(items)
        system = offline_system(name)
        # The model gets the compact brief (token cost and latency), never the full JSON.
        assert json.dumps(brief.system(system), separators=(",", ":"), ensure_ascii=False) in text
        assert system.model_dump_json() not in text
        assert "Trappist One" in loop.INSTRUCTIONS and "TOI seven hundred" in loop.INSTRUCTIONS
        return answer("These are dated Snapshot measurements.")

    result = loop.run_loop("What is measured?", name, generate)
    assert result.error is None
    assert result.data.system == offline_system(name)
    assert result.data.system is not None
    assert result.data.system.provenance.mode == "snapshot"
    assert result.steps == []


def test_current_context_does_not_clear_failed_lookup_without_later_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def load(name: str) -> System:
        if name == "TRAPPIST-1":
            return offline_system(name)
        raise CatalogError("Unknown System name")

    patch_catalog(monkeypatch, load)
    responses = iter([answer(call(name="made up")), answer("Loaded it.")])
    result = loop.run_loop("Open made up", "TRAPPIST-1", lambda _: next(responses))
    assert result.error == "Unknown System name"
    assert result.reply_text == result.error
    assert result.ui_commands == []
    assert result.data.system is not None
    assert len(result.steps) == 1 and result.steps[0].status == "failed"
