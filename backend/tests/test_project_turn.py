"""Every turn is saved to its Project; a Project problem never fails the turn."""

from pathlib import Path

import pytest

from exoscope.agent import turn
from exoscope.agent.models import ToolStep, TurnData, TurnRequest
from exoscope.agent.result import AgentResult
from exoscope.project import Project, ProjectStore
from tests.project_fakes import T0, snapshot_system, web_search


@pytest.fixture(autouse=True)
def quiet(monkeypatch: pytest.MonkeyPatch) -> None:
    def agent(text: str, current: str | None) -> AgentResult:
        system = snapshot_system()
        step = ToolStep(
            id="1", name="load_system", status="completed", detail="7 planets", elapsed_ms=900
        )
        data = TurnData(system=system, web_search=web_search("https://a.org/1"))
        return AgentResult(reply_text="Loaded.", data=data, steps=[step])

    def silent(_: str) -> None:
        raise turn.voice.VoiceError("Voice off in tests.")

    monkeypatch.setattr(turn, "run_agent", agent)
    monkeypatch.setattr(turn.voice, "synthesize", silent)


def test_turn_is_recorded_and_saved(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path)
    p = store.create("Rocky worlds", now=T0)

    response = turn.handle_turn(TurnRequest(text="Open TRAPPIST-1", project_id=p.id), store)

    saved = store.load(p.id)
    assert response.project == saved
    assert [s.system.hostname for s in saved.systems] == ["TRAPPIST-1"]
    assert saved.turns[0].transcript == "Open TRAPPIST-1"
    assert [s.name for s in saved.turns[0].steps] == ["load_system"]
    assert [w.url for w in saved.web_sources] == ["https://a.org/1"]


def test_the_projects_current_system_is_used_when_the_request_names_none(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = ProjectStore(tmp_path)
    p = store.create("A", now=T0)
    turn.handle_turn(TurnRequest(text="Open TRAPPIST-1", project_id=p.id), store)
    seen: list[str | None] = []

    def agent(_: str, current: str | None) -> AgentResult:
        seen.append(current)
        return AgentResult(reply_text="Compared.")

    monkeypatch.setattr(turn, "run_agent", agent)
    turn.handle_turn(TurnRequest(text="Compare radius", project_id=p.id), store)
    turn.handle_turn(
        TurnRequest(text="Compare radius", project_id=p.id, current_system="TOI-700"), store
    )
    assert seen == ["TRAPPIST-1", "TOI-700"]


def test_without_a_project_nothing_is_saved(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path)
    response = turn.handle_turn(TurnRequest(text="Open TRAPPIST-1"), store)
    assert response.project is None
    assert store.list() == []


def test_unknown_project_warns_but_the_turn_still_answers(tmp_path: Path) -> None:
    request = TurnRequest(text="Open TRAPPIST-1", project_id="p-0000beef")
    response = turn.handle_turn(request, ProjectStore(tmp_path))

    assert response.error is None and response.data.system is not None
    assert response.project is None
    assert any("p-0000beef" in w and "not saved" in w for w in response.warnings)


def test_save_failure_warns_but_the_turn_still_answers(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = ProjectStore(tmp_path)
    p = store.create("A", now=T0)

    def disk_full(_: Project) -> None:
        raise OSError("No space left on device")

    monkeypatch.setattr(store, "save", disk_full)
    response = turn.handle_turn(TurnRequest(text="Open TRAPPIST-1", project_id=p.id), store)

    assert response.error is None and response.data.system is not None
    assert response.project is None
    assert any("not saved" in w for w in response.warnings)
    assert store.load(p.id).turns == []
