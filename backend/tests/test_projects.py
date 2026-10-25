"""Persistence failures must be explicit and leave durable evidence unchanged."""

import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from pydantic import ValidationError

from exoscope.catalog.sample_models import Exclusion, Sample
from exoscope.compare import compare
from exoscope.project.models import (
    ProjectAction,
    ProjectState,
    ReportRecord,
    SavedComparison,
    SavedSample,
    now,
)
from exoscope.project.storage import ProjectError, execute
from tests.project_fixtures import conversation_turn
from tests.test_turn import offline_system


@pytest.fixture(autouse=True)
def project_directory(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("EXOSCOPE_PROJECT_DIR", str(tmp_path))


def test_create_switch_and_restore_all_evidence(tmp_path: Path) -> None:
    first = execute(ProjectAction(operation="bootstrap")).current
    assert first is not None
    state = ProjectState(
        system=offline_system("TOI-700"),
        loadedSystems=[offline_system("TRAPPIST-1"), offline_system("TOI-700")],
        daysPerSecond=20,
        drawerOpen=True,
        focusedPlanetName="TRAPPIST-1 e",
        samples=[
            SavedSample(
                id=1,
                sample=Sample(
                    filters=[],
                    interpretations=[],
                    sort=None,
                    limit=10,
                    fields=[],
                    planets=[],
                    matched=0,
                    truncated=False,
                    excluded=Exclusion(count=0, by_field={}, reason="None"),
                    provenance=offline_system("TRAPPIST-1").provenance,
                    notes=[],
                ),
            )
        ],
        comparisons=[
            SavedComparison(
                id=1, comparison=compare([offline_system("TRAPPIST-1")], "radius", "insolation")
            )
        ],
        turns=[conversation_turn()],
        activeComparisonId=1,
        sceneSettings={"labels": True, "colorBy": "radius", "orbitBands": True},
        draft="My next question",
        transcript="Compare radius",
        replyText="The radius is missing.",
    )
    saved = execute(ProjectAction(operation="save", id=first.id, revision=0, state=state)).current
    assert saved is not None
    assert saved.revision == 1
    second = execute(ProjectAction(operation="create", title="Second Project")).current
    assert second is not None and second.state == ProjectState()
    assert execute(ProjectAction(operation="bootstrap")).current == second
    assert execute(ProjectAction(operation="load", id=first.id)).current == saved
    # Reading again from disk models a new process, not a module-level in-memory cache.
    assert execute(ProjectAction(operation="bootstrap")).current == saved
    document = json.loads((tmp_path / f"{first.id}.json").read_text())
    assert document["state"] == state.model_dump(mode="json")
    restarted = subprocess.run(
        [
            sys.executable,
            "-c",
            "from exoscope.project.storage import execute; "
            "from exoscope.project.models import ProjectAction; "
            "print(execute(ProjectAction(operation='bootstrap')).model_dump_json())",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    assert json.loads(restarted.stdout)["current"] == saved.model_dump(mode="json")


def test_missing_or_corrupt_never_silently_creates_empty(tmp_path: Path) -> None:
    first = execute(ProjectAction(operation="bootstrap")).current
    assert first is not None
    path = tmp_path / f"{first.id}.json"
    path.unlink()
    with pytest.raises(ProjectError, match="missing"):
        execute(ProjectAction(operation="bootstrap"))
    assert not path.exists()
    path.write_text("{partial")
    with pytest.raises(ProjectError, match="corrupt"):
        execute(ProjectAction(operation="bootstrap"))
    assert path.read_text() == "{partial"


def test_stale_save_cannot_overwrite_newer_work(tmp_path: Path) -> None:
    first = execute(ProjectAction(operation="bootstrap")).current
    assert first is not None
    action = ProjectAction(
        operation="save", id=first.id, revision=0, state=ProjectState(draft="new")
    )
    execute(action)
    before = (tmp_path / f"{first.id}.json").read_bytes()
    with pytest.raises(ProjectError, match="another tab"):
        execute(action.model_copy(update={"state": ProjectState(draft="stale")}))
    assert (tmp_path / f"{first.id}.json").read_bytes() == before


def test_atomic_failure_preserves_previous_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    from exoscope.project import storage

    first = execute(ProjectAction(operation="bootstrap")).current
    assert first is not None
    before = (tmp_path / f"{first.id}.json").read_bytes()

    def fail(*_: object) -> None:
        raise OSError("disk unavailable")

    monkeypatch.setattr(storage.os, "replace", fail)
    with pytest.raises(ProjectError, match="unavailable"):
        execute(ProjectAction(operation="save", id=first.id, revision=0, state=ProjectState()))
    assert (tmp_path / f"{first.id}.json").read_bytes() == before
    assert not list(tmp_path.glob(".pending-*"))


def test_corrupt_current_pointer_is_an_explicit_error(tmp_path: Path) -> None:
    execute(ProjectAction(operation="bootstrap"))
    (tmp_path / "current.json").write_text("null")
    with pytest.raises(ProjectError, match="pointer is corrupt"):
        execute(ProjectAction(operation="bootstrap"))


def test_state_save_preserves_server_reports(tmp_path: Path) -> None:
    from exoscope.project import storage

    project = execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    report = ReportRecord(
        id="f" * 32,
        title="Radius evidence",
        created_at=now(),
        html="<!doctype html><h1>Radius evidence</h1>",
        included=("comparison:radius",),
    )
    project.reports = [report]
    storage.persist(project)
    result = execute(
        ProjectAction(operation="save", id=project.id, revision=0, state=ProjectState(draft="next"))
    )
    assert result.current is not None and result.current.reports == [report]
    assert json.loads((tmp_path / f"{project.id}.json").read_text())["reports"] == [
        report.model_dump(mode="json")
    ]
    with pytest.raises(ValidationError, match="frozen"):
        report.title = "Changed"


def test_two_concurrent_saves_only_one_can_win() -> None:
    project = execute(ProjectAction(operation="bootstrap")).current
    assert project is not None

    def save(draft: str) -> str:
        try:
            execute(
                ProjectAction(
                    operation="save", id=project.id, revision=0, state=ProjectState(draft=draft)
                )
            )
            return "saved"
        except ProjectError:
            return "stale"

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(save, ["one", "two"])) == ["saved", "stale"]
    current = execute(ProjectAction(operation="bootstrap")).current
    assert current is not None and current.revision == 1
    assert current.state.draft in {"one", "two"}


def test_separate_backend_processes_cannot_overwrite_each_other() -> None:
    project = execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    script = """
import sys
from exoscope.project.models import ProjectAction, ProjectState
from exoscope.project.storage import ProjectError, execute
try:
    execute(ProjectAction(operation='save', id=sys.argv[1], revision=0,
                          state=ProjectState(draft=sys.argv[2])))
    print('saved')
except ProjectError:
    print('stale')
"""
    processes = [
        subprocess.Popen(
            [sys.executable, "-c", script, project.id, draft],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        for draft in ("first process", "second process")
    ]
    outcomes: list[str] = []
    for process in processes:
        stdout, stderr = process.communicate(timeout=10)
        assert process.returncode == 0, stderr
        outcomes.append(stdout.strip())
    assert sorted(outcomes) == ["saved", "stale"]
    restored = execute(ProjectAction(operation="bootstrap")).current
    assert restored is not None and restored.revision == 1
    assert restored.state.draft in {"first process", "second process"}
