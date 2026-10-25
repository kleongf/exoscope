"""Project actions share /turn, validate inputs, and never call model/voice providers."""

from pathlib import Path

import pytest

from exoscope.agent import turn
from exoscope.agent.models import TurnResponse
from exoscope.compare import compare
from exoscope.project.models import ProjectResult
from tests.test_app import request
from tests.test_turn import offline_system

IDENTIFIER = "a" * 32


@pytest.fixture(autouse=True)
def isolated_projects(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("EXOSCOPE_PROJECT_DIR", str(tmp_path))

    def forbidden(*_: object) -> None:
        pytest.fail("Project operation called Gemma or a voice provider")

    monkeypatch.setattr(turn, "run_agent", forbidden)
    monkeypatch.setattr(turn.voice, "transcribe", forbidden)
    monkeypatch.setattr(turn.voice, "synthesize", forbidden)


def action(payload: dict[str, object]) -> ProjectResult:
    response = request("POST", "/turn", {"project_action": payload})
    assert response.status_code == 200
    result = TurnResponse.model_validate(response.json())
    assert result.error is None
    assert result.transcript == result.reply_text == ""
    assert result.reply_audio is None and result.ui_commands == [] and result.steps == []
    assert result.data.system is None and result.data.web_search is None
    assert result.project_result is not None
    return result.project_result


def test_api_bootstrap_save_list_create_load() -> None:
    project = action({"operation": "bootstrap"}).current
    assert project is not None
    saved = action(
        {
            "operation": "save",
            "id": project.id,
            "revision": 0,
            "title": "Radius comparison",
            "state": {
                "draft": "Next question",
                "comparisons": [
                    {
                        "id": 1,
                        "comparison": compare(
                            [offline_system("TRAPPIST-1")], "radius", "insolation"
                        ).model_dump(mode="json"),
                    }
                ],
            },
        }
    ).current
    assert saved is not None and saved.revision == 1 and saved.title == "Radius comparison"
    assert saved.created_at == project.created_at
    second = action({"operation": "create", "title": "Second Project"}).current
    assert second is not None and second.id != project.id and second.state.draft == ""
    listing = action({"operation": "list"})
    assert listing.current is None and len(listing.projects) == 2
    assert {item.id for item in listing.projects} == {project.id, second.id}
    assert action({"operation": "load", "id": project.id}).current == saved
    assert action({"operation": "bootstrap"}).current == saved


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"project_action": {}},
        {"project_action": {"operation": "delete"}},
        {"project_action": {"operation": "load"}},
        {"project_action": {"operation": "save", "id": IDENTIFIER, "state": {}}},
        {"project_action": {"operation": "save", "id": IDENTIFIER, "revision": 0}},
        {"project_action": {"operation": "save", "id": IDENTIFIER, "revision": -1, "state": {}}},
        {"project_action": {"operation": "save", "id": IDENTIFIER, "revision": True, "state": {}}},
        {"project_action": {"operation": "save", "id": IDENTIFIER, "revision": "0", "state": {}}},
        {"project_action": {"operation": "load", "id": "../current"}},
        {"project_action": {"operation": "load", "id": "A" * 32}},
        {"project_action": {"operation": "create", "title": "   "}},
        {"project_action": {"operation": "create", "reports": []}},
        {"project_action": {"operation": "create", "state": {"draft": "injected"}}},
        {"project_action": {"operation": "list", "id": IDENTIFIER}},
        {"project_action": {"operation": "load", "id": IDENTIFIER, "revision": 0}},
        {"project_action": {"operation": "bootstrap"}, "text": "hello"},
        {
            "project_action": {"operation": "bootstrap"},
            "audio": {"data_base64": "YQ==", "mime_type": "audio/webm"},
        },
        {"project_action": {"operation": "bootstrap"}, "project_id": "../../outside"},
    ],
)
def test_invalid_actions_are_rejected_before_storage(
    payload: dict[str, object], tmp_path: Path
) -> None:
    assert request("POST", "/turn", payload).status_code == 422
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    "state",
    [
        list[object](),
        {"reports": list[object]()},
        {"unknown": "ignored data is unacceptable"},
        {"system": {"hostname": "invalid"}},
        {"loadedSystems": [dict[str, object]()]},
        {"turns": ["invalid"]},
        {"samples": dict[str, object]()},
        {"comparisons": [None]},
        {"activeComparisonId": list[object]()},
        {"sceneSettings": list[object]()},
        {"drawerOpen": "false"},
        {"daysPerSecond": -1},
        {"daysPerSecond": 1001},
        {"draft": 5},
    ],
)
def test_invalid_state_never_overwrites_saved_work(state: object, tmp_path: Path) -> None:
    project = action({"operation": "bootstrap"}).current
    assert project is not None
    path = tmp_path / f"{project.id}.json"
    before = path.read_bytes()
    response = request(
        "POST",
        "/turn",
        {"project_action": {"operation": "save", "id": project.id, "revision": 0, "state": state}},
    )
    assert response.status_code == 422
    assert path.read_bytes() == before


def test_missing_corrupt_and_stale_are_explicit_api_errors(tmp_path: Path) -> None:
    project = action({"operation": "bootstrap"}).current
    assert project is not None
    action({"operation": "save", "id": project.id, "revision": 0, "state": {"draft": "saved"}})
    stale = request(
        "POST",
        "/turn",
        {"project_action": {"operation": "save", "id": project.id, "revision": 0, "state": {}}},
    )
    assert stale.status_code == 200
    assert "another tab" in stale.json()["error"]
    path = tmp_path / f"{project.id}.json"
    assert '"draft":"saved"' in path.read_text()
    for content, expected in [(None, "missing"), ("{bad", "corrupt")]:
        if content is None:
            path.unlink()
        else:
            path.write_text(content)
        response = request("POST", "/turn", {"project_action": {"operation": "bootstrap"}})
        assert response.status_code == 200
        body = response.json()
        assert expected in body["error"] and body["project_result"] is None
        assert body["transcript"] == body["reply_text"] == ""
    assert path.read_text() == "{bad"


def test_valid_project_id_is_reserved_for_normal_turns(monkeypatch: pytest.MonkeyPatch) -> None:
    from exoscope.agent.loop import AgentResult

    def agent(text: str, current: str | None) -> AgentResult:
        assert text == "Open TRAPPIST-1" and current is None
        return AgentResult(error="Provider unavailable")

    monkeypatch.setattr(turn, "run_agent", agent)
    response = request("POST", "/turn", {"text": "Open TRAPPIST-1", "project_id": IDENTIFIER})
    assert response.status_code == 200
    assert response.json()["project_result"] is None
    assert response.json()["error"] == "Provider unavailable"
