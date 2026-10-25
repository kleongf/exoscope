"""One JSON file per Project, atomic replacement and optimistic revision checks."""

import fcntl
import json
import os
import re
import tempfile
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from threading import RLock

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from exoscope.project.models import (
    Project,
    ProjectAction,
    ProjectResult,
    ProjectState,
    ProjectSummary,
    now,
)

_LOCK = RLock()


class ProjectError(Exception):
    """A missing, corrupt, stale or unwritable Project must never look empty."""


class _CurrentProject(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: str = Field(pattern=r"^[a-f0-9]{32}$")


def root() -> Path:
    configured = os.environ.get("EXOSCOPE_PROJECT_DIR")
    return (
        Path(configured) if configured else Path(__file__).resolve().parents[3] / ".data/projects"
    )


@contextmanager
def locked() -> Generator[None]:
    # RLock covers threads; flock covers separate local backend workers/processes.
    with _LOCK:
        directory = root()
        directory.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(directory / ".lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, "a") as handle:
            fcntl.flock(handle, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)


def _path(identifier: str) -> Path:
    if not re.fullmatch(r"[a-f0-9]{32}", identifier):
        raise ProjectError("Invalid Project identifier.")
    return root() / f"{identifier}.json"


def _read(path: Path) -> str:
    # Do not follow even a dangling symlink into another Project directory.
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, encoding="utf-8") as handle:
        return handle.read()


def load(identifier: str) -> Project:
    try:
        project = Project.model_validate_json(_read(_path(identifier)))
    except FileNotFoundError as exc:
        raise ProjectError("This Project file is missing. Nothing was replaced.") from exc
    except (ValidationError, UnicodeError) as exc:
        raise ProjectError("This Project file is corrupt. Nothing was replaced.") from exc
    if project.id != identifier:
        raise ProjectError("This Project file has a mismatched identifier.")
    # Defaults are useful for New Project and API saves, but a partial stored
    # document must never silently replace lost evidence with default empty lists.
    if project.model_fields_set != set(Project.model_fields) or (
        project.state.model_fields_set != set(ProjectState.model_fields)
    ):
        raise ProjectError("This Project file is incomplete or corrupt. Nothing was replaced.")
    return project


def atomic_write(path: Path, content: str) -> None:
    if path.is_symlink():
        raise ProjectError(
            "Project storage contains an unsafe symbolic link. Nothing was replaced."
        )
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix=".pending-")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        # Persist the rename as well as the contents before acknowledging a save.
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        Path(temporary).unlink(missing_ok=True)


def persist(project: Project) -> None:
    atomic_write(_path(project.id), project.model_dump_json())


def summaries() -> list[ProjectSummary]:
    # iterdir propagates read/permission errors instead of treating them as an empty directory.
    return [
        _summary(load(path.stem))
        for path in root().iterdir()
        if path.suffix == ".json" and path.name != "current.json"
    ]


def _summary(project: Project) -> ProjectSummary:
    return ProjectSummary(
        id=project.id, title=project.title, revision=project.revision, updated_at=project.updated_at
    )


def _select(project: Project) -> None:
    atomic_write(root() / "current.json", json.dumps({"id": project.id}))


def _bootstrap(existing: list[ProjectSummary]) -> Project:
    try:
        raw = _read(root() / "current.json")
    except FileNotFoundError:
        if existing:
            raise ProjectError(
                "The current Project pointer is missing. Choose a saved Project."
            ) from None
        return _create(None)
    except UnicodeError as exc:
        raise ProjectError(
            "The current Project pointer is corrupt. No Project was replaced."
        ) from exc
    try:
        identifier = _CurrentProject.model_validate_json(raw).id
    except ValidationError as exc:
        raise ProjectError(
            "The current Project pointer is corrupt. No Project was replaced."
        ) from exc
    return load(identifier)


def _create(title: str | None) -> Project:
    project = Project(title=title or "Untitled Project")
    if _path(project.id).exists() or _path(project.id).is_symlink():
        raise ProjectError("A Project with that identifier already exists. Nothing was replaced.")
    persist(project)
    _select(project)
    return project


def _execute(action: ProjectAction, existing: list[ProjectSummary]) -> Project | None:
    if action.operation == "bootstrap":
        return _bootstrap(existing)
    if action.operation == "create":
        return _create(action.title)
    if action.operation == "list":
        return None
    if action.id is None:
        raise ProjectError("Choose a Project first.")
    project = load(action.id)
    if action.operation == "save":
        if action.revision != project.revision:
            raise ProjectError("This Project changed in another tab. Reload before saving again.")
        if action.state is None:
            raise ProjectError("Project state is required to save.")
        project.state = action.state
        if action.title is not None:
            project.title = action.title
        project.revision += 1
        project.updated_at = now()
        persist(project)
    else:
        _select(project)
    return project


def execute(action: ProjectAction) -> ProjectResult:
    try:
        with locked():
            # Read the list before mutation so a corrupt unrelated file cannot make a
            # successful write appear to have failed afterwards.
            existing = summaries()
            project = _execute(action, existing)
            if project is not None:
                existing = [item for item in existing if item.id != project.id]
                existing.append(_summary(project))
            return ProjectResult(
                current=project,
                projects=sorted(
                    existing, key=lambda item: (item.updated_at, item.id), reverse=True
                ),
            )
    except (OSError, UnicodeError) as exc:
        # fsync or pointer writes can fail after persistence; don't promise rollback.
        raise ProjectError(
            "Project storage is unavailable. Reload before retrying; a write may have completed."
        ) from exc
