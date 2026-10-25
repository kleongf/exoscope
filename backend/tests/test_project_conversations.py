"""Durable conversation history is validated before save and on disk reads."""

import json
from pathlib import Path

import pytest
from pydantic import JsonValue, ValidationError

from exoscope.agent.models import ToolStep as ResponseToolStep
from exoscope.project.models import ConversationTurn, ProjectAction, ProjectState
from exoscope.project.storage import ProjectError, execute, load
from exoscope.tool_steps import ToolStep
from tests.project_fixtures import conversation_turn
from tests.test_app import request


@pytest.fixture(autouse=True)
def project_directory(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("EXOSCOPE_PROJECT_DIR", str(tmp_path))


def malformed_turns() -> list[tuple[str, JsonValue]]:
    valid: dict[str, JsonValue] = conversation_turn().model_dump(mode="json")
    cases: list[tuple[str, JsonValue]] = [("empty", {}), ("null", None)]
    cases.extend(
        (f"missing-{field}", {key: value for key, value in valid.items() if key != field})
        for field in ConversationTurn.model_fields
    )
    invalid: dict[str, JsonValue] = {
        "id": "1",
        "question": [],
        "reply": {},
        "startedAt": "1000",
        "finishedAt": False,
        "steps": None,
        "provenance": {"mode": "unknown"},
        "error": [],
        "warnings": [None],
        "appliedCommands": True,
        "webSearch": [],
        "hasSpokenReply": "false",
        "unexpected": "must not be silently dropped",
    }
    cases.extend((f"invalid-{field}", valid | {field: value}) for field, value in invalid.items())
    nested: list[dict[str, JsonValue]] = [
        {"steps": [{}]},
        {"steps": [{"id": "s", "name": "search", "detail": "done", "elapsed_ms": 1}]},
        {
            "steps": [
                {"id": "s", "name": "search", "status": "running", "detail": "", "elapsed_ms": 1}
            ]
        },
        {
            "steps": [
                {"id": "s", "name": "search", "status": "failed", "detail": "", "elapsed_ms": -1}
            ]
        },
        {
            "steps": [
                {"id": "s", "name": "search", "status": "failed", "detail": "", "elapsed_ms": "1"}
            ]
        },
        {"webSearch": {}},
        {"webSearch": {"status": "ok", "query": "water", "sources": [{}]}},
        {"webSearch": {"status": "ok", "query": "water", "sources": "invalid"}},
        {"webSearch": {"status": "ok", "query": "water", "supports": [{}]}},
        {
            "webSearch": {
                "status": "ok",
                "query": "water",
                "supports": [{"text": "claim", "source_ids": [None]}],
            }
        },
    ]
    cases.extend((f"nested-{index}", valid | update) for index, update in enumerate(nested))
    return cases


@pytest.mark.parametrize(("case", "record"), malformed_turns())
def test_malformed_conversation_is_rejected_before_api_save(
    case: str, record: JsonValue, tmp_path: Path
) -> None:
    project = execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    path = tmp_path / f"{project.id}.json"
    before = path.read_bytes()
    response = request(
        "POST",
        "/turn",
        {
            "project_action": {
                "operation": "save",
                "id": project.id,
                "revision": 0,
                "state": {"turns": [record]},
            }
        },
    )
    assert response.status_code == 422, case
    assert path.read_bytes() == before


@pytest.mark.parametrize(("case", "record"), malformed_turns())
def test_malformed_stored_conversation_is_an_explicit_corruption_error(
    case: str, record: JsonValue, tmp_path: Path
) -> None:
    project = execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    path = tmp_path / f"{project.id}.json"
    document = project.model_dump(mode="json")
    document["state"]["turns"] = [record]
    path.write_text(json.dumps(document))
    before = path.read_bytes()
    with pytest.raises(ProjectError, match="corrupt"):
        load(project.id)
    response = request("POST", "/turn", {"project_action": {"operation": "bootstrap"}})
    assert response.status_code == 200, case
    assert "corrupt" in response.json()["error"]
    assert response.json()["project_result"] is None
    assert path.read_bytes() == before


def test_complete_and_unfinished_turns_round_trip_through_api_and_disk(tmp_path: Path) -> None:
    project = execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    completed = conversation_turn()
    unfinished = ConversationTurn(
        id=2,
        question="Open TOI-700",
        reply="",
        startedAt=completed.finishedAt or completed.startedAt,
        finishedAt=None,
        steps=[],
        provenance=None,
        error=None,
        warnings=[],
        appliedCommands=0,
        webSearch=None,
        hasSpokenReply=False,
    )
    state = ProjectState(turns=[completed, unfinished])
    response = request(
        "POST",
        "/turn",
        {
            "project_action": {
                "operation": "save",
                "id": project.id,
                "revision": 0,
                "state": state.model_dump(mode="json"),
            }
        },
    )
    assert response.status_code == 200
    assert response.json()["error"] is None
    assert response.json()["project_result"]["current"]["state"] == state.model_dump(mode="json")
    assert load(project.id).state == state
    stored = json.loads((tmp_path / f"{project.id}.json").read_text())
    assert stored["state"] == state.model_dump(mode="json")
    assert ResponseToolStep is ToolStep


@pytest.mark.parametrize("field", ["startedAt", "finishedAt", "steps"])
@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_nonfinite_turn_values_fail_python_and_json_validation(field: str, value: float) -> None:
    record = conversation_turn().model_dump(mode="json")
    if field == "steps":
        record["steps"][0]["elapsed_ms"] = value
    else:
        record[field] = value
    state = {"turns": [record]}
    with pytest.raises(ValidationError):
        ProjectState.model_validate(state)
    with pytest.raises(ValidationError):
        ProjectState.model_validate_json(json.dumps(state))
