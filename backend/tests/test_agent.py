"""SDK-shaped responses exercise the manual tool boundary without a live provider."""

import pytest
from google.genai import types

from exoscope.agent import loop, model_config, turn
from exoscope.catalog import CatalogError, CatalogUnavailableError, System, load_system
from exoscope.catalog.tap import Row
from exoscope.voice.models import ReplyAudio


def offline_system(name: str) -> System:
    def unavailable(_: str) -> list[Row]:
        raise CatalogUnavailableError("Archive unavailable in offline test.")

    return load_system(name, tap=unavailable)


def answer(*parts: types.Part) -> types.GenerateContentResponse:
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=list(parts)))]
    )


def call(tool_name: str = "load_system", **arguments: object) -> types.Part:
    return types.Part(
        function_call=types.FunctionCall(id="tool-id", name=tool_name, args=arguments)
    )


def test_tool_result_round_trip_and_validated_command(monkeypatch: pytest.MonkeyPatch) -> None:
    system = offline_system("TRAPPIST-1")

    def load(_: str) -> System:
        return system

    monkeypatch.setattr(loop, "load_system", load)
    requests: list[list[types.Content]] = []

    def generate(contents: list[types.Content]) -> types.GenerateContentResponse:
        requests.append(list(contents))
        if len(requests) == 1:
            return answer(call(**{"name": "trappist-1"}))
        response = (contents[-1].parts or [])[0].function_response
        assert response is not None and response.id == "tool-id"
        assert response.response is not None and "system" in response.response
        return answer(types.Part(text="Loaded TRAPPIST-1 from the dated Snapshot."))

    result = loop.run_loop("Open TRAPPIST-1", None, generate)
    assert result.error is None
    assert result.ui_commands[0].kind == "load_system"
    assert result.data.system == system
    assert result.warnings
    assert requests[1][1].role == "model"


def test_unknown_tool_error_retained_even_if_model_claims_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unknown(_: str) -> System:
        raise CatalogError("Unknown System name")

    monkeypatch.setattr(loop, "load_system", unknown)
    replies = iter([answer(call(**{"name": "made up"})), answer(types.Part(text="Loaded it."))])
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

    monkeypatch.setattr(loop, "load_system", load)
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
    monkeypatch.setattr(loop, "load_system", offline_system)
    responses = iter(
        [answer(call(**{"name": "TRAPPIST-1"})) for _ in range(5)]
        + [answer(types.Part(text="Loaded from Snapshot."))]
    )
    assert loop.run_loop("open", None, lambda _: next(responses)).error is None


def test_provider_failure_after_tool_retains_evidence(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(loop, "load_system", offline_system)
    responses = iter([answer(call(**{"name": "TRAPPIST-1"}))])
    result = loop.run_loop("open", None, lambda _: next(responses))
    assert result.error is not None and "unverified" in result.error
    assert len(result.ui_commands) == 1
    assert result.data.system is not None


def test_current_system_is_refetched_and_canonicalized(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(loop, "load_system", offline_system)

    def generate(contents: list[types.Content]) -> types.GenerateContentResponse:
        text = (contents[0].parts or [])[0].text or ""
        assert '"hostname":"TRAPPIST-1"' in text
        return answer(types.Part(text="The catalog has seven planets in this System."))

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

    monkeypatch.setattr(loop, "load_system", load)
    responses = iter(
        [
            answer(call(**{"name": "TRAPPIST-1"})),
            answer(types.Part(text="Opened TRAPPIST-1 from the dated Snapshot.")),
        ]
    )
    result = loop.run_loop("Open TRAPPIST-1", "Kepler-186", lambda _: next(responses))
    assert result.error is None
    assert result.data.system is not None
    assert result.data.system.hostname == "TRAPPIST-1"
    assert len(result.ui_commands) == 1
    assert any("Current System data is unavailable" in warning for warning in result.warnings)


def test_no_key_returns_useful_safe_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    result = loop.run_agent("Open TRAPPIST-1")
    assert result.error is not None and "not configured" in result.error
    assert not result.ui_commands


@pytest.mark.parametrize(
    "tool_part",
    [call("execute_sql", sql="select * from pscomppars"), call(name="TRAPPIST-1", sql="ignored")],
)
def test_unlisted_tools_and_extra_arguments_never_execute(
    monkeypatch: pytest.MonkeyPatch, tool_part: types.Part
) -> None:
    def forbidden(_: str) -> System:
        pytest.fail("Invalid tool input reached catalog")

    monkeypatch.setattr(loop, "load_system", forbidden)
    responses = iter([answer(tool_part), answer(types.Part(text="Success."))])
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
            answer(types.Part(text="Opened TRAPPIST-1 from the dated Snapshot.")),
        ]
    )
    clock = iter([10.0, 10.025, 20.0, 20.05])
    monkeypatch.setattr(loop, "monotonic", lambda: next(clock))
    monkeypatch.setattr(loop, "load_system", load)

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
    monkeypatch.setattr(loop, "load_system", offline_system)

    def generate(contents: list[types.Content]) -> types.GenerateContentResponse:
        text = (contents[0].parts or [])[0].text or ""
        assert offline_system(name).model_dump_json() in text
        assert "Trappist One" in text and "TOI seven hundred" in text
        return answer(types.Part(text="These are dated Snapshot measurements."))

    result = loop.run_loop("What is measured?", name, generate)
    assert result.error is None
    assert result.data.system == offline_system(name)
    assert result.data.system is not None
    assert result.data.system.provenance.mode == "snapshot"
    assert result.steps == []


@pytest.mark.parametrize("selected", ["gemma-4-26b-a4b-it", "gemma-4-31b-it"])
def test_explicit_model_selection(monkeypatch: pytest.MonkeyPatch, selected: str) -> None:
    monkeypatch.setenv("GEMMA_MODEL", selected)
    assert model_config.gemma_model() == selected


def test_default_model_and_invalid_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMMA_MODEL", raising=False)
    assert model_config.gemma_model() == "gemma-4-26b-a4b-it"
    monkeypatch.setenv("GEMMA_MODEL", "not-a-supported-model")
    with pytest.raises(ValueError, match="supported hosted Gemma"):
        model_config.gemma_model()


def test_current_context_does_not_clear_failed_lookup_without_later_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def load(name: str) -> System:
        if name == "TRAPPIST-1":
            return offline_system(name)
        raise CatalogError("Unknown System name")

    monkeypatch.setattr(loop, "load_system", load)
    responses = iter([answer(call(name="made up")), answer(types.Part(text="Loaded it."))])
    result = loop.run_loop("Open made up", "TRAPPIST-1", lambda _: next(responses))
    assert result.error == "Unknown System name"
    assert result.reply_text == result.error
    assert result.ui_commands == []
    assert result.data.system is not None
    assert len(result.steps) == 1 and result.steps[0].status == "failed"
