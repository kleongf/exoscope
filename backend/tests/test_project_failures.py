"""Fault injection verifies honest failures, atomic writes, and safe file boundaries."""

import json
from pathlib import Path
from uuid import UUID

import pytest
from pydantic import ValidationError

from exoscope.project import models, storage
from exoscope.project.models import ProjectAction, ProjectState
from tests.test_app import request


@pytest.fixture(autouse=True)
def project_directory(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("EXOSCOPE_PROJECT_DIR", str(tmp_path))


def test_missing_pointer_requires_selection_and_load_recovers(tmp_path: Path) -> None:
    project = storage.execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    (tmp_path / "current.json").unlink()
    with pytest.raises(storage.ProjectError, match="pointer is missing"):
        storage.execute(ProjectAction(operation="bootstrap"))
    assert len(list(tmp_path.glob("*.json"))) == 1
    assert storage.execute(ProjectAction(operation="load", id=project.id)).current == project
    assert storage.execute(ProjectAction(operation="bootstrap")).current == project


@pytest.mark.parametrize(
    "pointer", ["[]", '"id"', '{"id":4}', '{"id":"../outside"}', '{"id":null}']
)
def test_invalid_pointer_shape_never_creates_a_project(pointer: str, tmp_path: Path) -> None:
    (tmp_path / "current.json").write_text(pointer)
    with pytest.raises(storage.ProjectError, match="pointer is corrupt"):
        storage.execute(ProjectAction(operation="bootstrap"))
    assert list(tmp_path.glob("*.json")) == [tmp_path / "current.json"]
    assert (tmp_path / "current.json").read_text() == pointer


@pytest.mark.parametrize("field,value", [("version", 2), ("id", "a" * 32), ("revision", "0")])
def test_corrupt_document_identity_and_schema_are_not_overwritten(
    field: str, value: object, tmp_path: Path
) -> None:
    project = storage.execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    path = tmp_path / f"{project.id}.json"
    document = json.loads(path.read_text())
    document[field] = value
    path.write_text(json.dumps(document))
    before = path.read_bytes()
    with pytest.raises(storage.ProjectError):
        storage.execute(
            ProjectAction(operation="save", id=project.id, revision=0, state=ProjectState())
        )
    assert path.read_bytes() == before


@pytest.mark.parametrize("step", ["read", "list", "lock", "write", "sync"])
def test_io_failure_is_an_api_error_and_preserves_previous_document(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, step: str
) -> None:
    project = storage.execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    path = tmp_path / f"{project.id}.json"
    before = path.read_bytes()

    def fail(*_: object, **__: object) -> None:
        raise OSError("private operating system error")

    if step == "read":
        monkeypatch.setattr(storage, "_read", fail)
    elif step == "list":
        monkeypatch.setattr(Path, "iterdir", fail)
    elif step == "lock":
        monkeypatch.setattr(storage.fcntl, "flock", fail)
    elif step == "write":
        monkeypatch.setattr(storage.tempfile, "mkstemp", fail)
    else:
        monkeypatch.setattr(storage.os, "fsync", fail)
    response = request(
        "POST",
        "/turn",
        {"project_action": {"operation": "save", "id": project.id, "revision": 0, "state": {}}},
    )
    assert response.status_code == 200
    assert "unavailable" in response.json()["error"]
    assert "private operating" not in response.text
    assert response.json()["project_result"] is None
    assert path.read_bytes() == before
    assert not list(tmp_path.glob(".pending-*"))


def test_corrupt_other_project_is_detected_before_write(tmp_path: Path) -> None:
    project = storage.execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    path = tmp_path / f"{project.id}.json"
    before = path.read_bytes()
    (tmp_path / f"{'a' * 32}.json").write_text("{partial")
    with pytest.raises(storage.ProjectError, match="corrupt"):
        storage.execute(
            ProjectAction(
                operation="save", id=project.id, revision=0, state=ProjectState(draft="x")
            )
        )
    assert path.read_bytes() == before


@pytest.mark.parametrize("section", ["document", "state"])
def test_valid_json_with_missing_fields_is_corruption(section: str, tmp_path: Path) -> None:
    project = storage.execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    path = tmp_path / f"{project.id}.json"
    document = json.loads(path.read_text())
    if section == "document":
        del document["state"]
    else:
        del document["state"]["turns"]
    path.write_text(json.dumps(document))
    before = path.read_bytes()
    with pytest.raises(storage.ProjectError, match="incomplete or corrupt"):
        storage.execute(ProjectAction(operation="bootstrap"))
    assert path.read_bytes() == before


def test_new_project_identifier_collision_cannot_overwrite(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    project = storage.execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    path = tmp_path / f"{project.id}.json"
    before = path.read_bytes()
    monkeypatch.setattr(models, "uuid4", lambda: UUID(project.id))
    with pytest.raises(storage.ProjectError, match="already exists"):
        storage.execute(ProjectAction(operation="create"))
    assert path.read_bytes() == before


@pytest.mark.parametrize("target", ["current.json", "project", ".lock"])
def test_storage_does_not_follow_symbolic_links(target: str, tmp_path: Path) -> None:
    project = storage.execute(ProjectAction(operation="bootstrap")).current
    assert project is not None
    path = tmp_path / (f"{project.id}.json" if target == "project" else target)
    outside = tmp_path.parent / "outside.json"
    content = path.read_bytes()
    outside.write_bytes(content)
    path.unlink()
    path.symlink_to(outside)
    with pytest.raises(storage.ProjectError, match="unavailable"):
        storage.execute(ProjectAction(operation="bootstrap"))
    assert outside.read_bytes() == content and path.is_symlink()


def test_pointer_failure_does_not_claim_the_project_was_rolled_back(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    previous = storage.execute(ProjectAction(operation="bootstrap")).current
    assert previous is not None
    original = storage.atomic_write

    def fail_pointer(path: Path, content: str) -> None:
        if path.name == "current.json":
            raise OSError("pointer is unwritable")
        original(path, content)

    monkeypatch.setattr(storage, "atomic_write", fail_pointer)
    with pytest.raises(storage.ProjectError, match="a write may have completed"):
        storage.execute(ProjectAction(operation="create", title="Saved but not selected"))
    assert len(list(tmp_path.glob("*.json"))) == 3
    assert storage.execute(ProjectAction(operation="bootstrap")).current == previous


@pytest.mark.parametrize("identifier", ["../current", "/tmp/outside", "..", "A" * 32, "a" * 31])
def test_direct_storage_identifier_validation(identifier: str) -> None:
    with pytest.raises(storage.ProjectError, match="Invalid Project identifier"):
        storage.load(identifier)


@pytest.mark.parametrize("field", ["daysPerSecond", "sceneSettings", "turns"])
def test_nonfinite_json_is_rejected_instead_of_silently_becoming_null(field: str) -> None:
    value: object = float("nan")
    if field == "sceneSettings":
        value = {"bad": float("inf")}
    elif field == "turns":
        value = [{"bad": float("nan")}]
    with pytest.raises(ValidationError):
        ProjectState.model_validate({field: value})
