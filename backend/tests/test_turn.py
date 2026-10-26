"""Shared turn ordering and partial failure retention; all providers are mocked."""

import pytest

from exoscope.agent import timing, turn
from exoscope.agent.loop import AgentResult
from exoscope.agent.models import TurnData, TurnRequest
from exoscope.catalog import CatalogUnavailableError, System, load_system
from exoscope.catalog.tap import Row
from exoscope.scene.commands import LoadSystem
from exoscope.voice.models import AudioInput, ReplyAudio


def offline_system(name: str) -> System:
    def unavailable(_: str) -> list[Row]:
        raise CatalogUnavailableError("Archive unavailable in offline test.")

    return load_system(name, tap=unavailable)


def successful_result() -> AgentResult:
    system = offline_system("TRAPPIST-1")
    return AgentResult(
        reply_text="Loaded TRAPPIST-1 from Snapshot.",
        ui_commands=[LoadSystem(system=system)],
        data=TurnData(system=system),
    )


def test_audio_pipeline_order(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[str] = []
    clock = iter([1.0, 1.5, 2.0, 2.8])
    monkeypatch.setattr(timing, "monotonic", lambda: next(clock))

    def transcribe(_: AudioInput) -> str:
        events.append("transcribe")
        return "Open TRAPPIST-1"

    def agent(text: str, current: str | None) -> AgentResult:
        assert text == "Open TRAPPIST-1" and current is None
        events.append("agent")
        return successful_result()

    def synthesize(text: str) -> ReplyAudio:
        assert text == "Loaded TRAPPIST-1 from Snapshot."
        events.append("synthesize")
        return ReplyAudio(data_base64="UklGRg==", mime_type="audio/wav")

    monkeypatch.setattr(turn.voice, "transcribe", transcribe)
    monkeypatch.setattr(turn, "run_agent", agent)
    monkeypatch.setattr(turn.voice, "synthesize", synthesize)
    response = turn.handle_turn(
        TurnRequest(audio=AudioInput(data_base64="YXVkaW8=", mime_type="audio/webm"))
    )
    assert events == ["transcribe", "agent", "synthesize"]
    assert response.transcript == "Open TRAPPIST-1"
    assert response.reply_audio is not None and response.error is None
    assert response.ui_commands[0].kind == "load_system"
    assert [step.name for step in response.steps] == ["transcribe", "synthesize"]
    assert all(step.status == "completed" for step in response.steps)
    assert [step.elapsed_ms for step in response.steps] == pytest.approx([500, 800])


def test_stt_failure_does_not_run_agent_or_synthesize(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(_: object) -> str:
        raise turn.voice.VoiceError("No speech recognized. Please type instead.")

    def forbidden(*_: object) -> AgentResult:
        pytest.fail("Downstream pipeline ran after STT failure")

    monkeypatch.setattr(turn.voice, "transcribe", fail)
    monkeypatch.setattr(turn, "run_agent", forbidden)
    monkeypatch.setattr(turn.voice, "synthesize", forbidden)
    response = turn.handle_turn(
        TurnRequest(audio=AudioInput(data_base64="YQ==", mime_type="audio/webm"))
    )
    assert response.transcript == ""
    assert response.error is not None and "type instead" in response.error
    assert response.reply_audio is None
    assert len(response.steps) == 1 and response.steps[0].status == "failed"


def test_agent_failure_after_stt_keeps_transcript(monkeypatch: pytest.MonkeyPatch) -> None:
    def transcribe(_: AudioInput) -> str:
        return "Open TRAPPIST-1"

    def agent(_: str, __: str | None) -> AgentResult:
        return AgentResult(error="The agent is unavailable")

    monkeypatch.setattr(turn.voice, "transcribe", transcribe)
    monkeypatch.setattr(turn, "run_agent", agent)
    response = turn.handle_turn(
        TurnRequest(audio=AudioInput(data_base64="YQ==", mime_type="audio/webm"))
    )
    assert response.transcript == "Open TRAPPIST-1"
    assert response.error == "The agent is unavailable"


def test_tts_failure_keeps_text_and_commands(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(_: str) -> ReplyAudio:
        raise turn.voice.VoiceError("Spoken reply unavailable")

    def agent(_: str, __: str | None) -> AgentResult:
        return successful_result()

    monkeypatch.setattr(turn, "run_agent", agent)
    monkeypatch.setattr(turn.voice, "synthesize", fail)
    response = turn.handle_turn(TurnRequest(text="Open TRAPPIST-1"))
    assert response.reply_text == "Loaded TRAPPIST-1 from Snapshot."
    assert response.data.system is not None and response.ui_commands
    assert response.reply_audio is None and response.error is None
    assert response.warnings == ["Spoken reply unavailable"]
    assert len(response.steps) == 1
    assert response.steps[0].name == "synthesize"
    assert response.steps[0].status == "failed"
