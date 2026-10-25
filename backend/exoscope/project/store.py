"""One JSON file per Project. A missing or unreadable file is an honest error, never empty."""

import os
import re
import secrets
from datetime import datetime
from pathlib import Path

from pydantic import ValidationError

from exoscope.project.errors import ProjectCorruptError, ProjectNotFoundError
from exoscope.project.models import Project, ProjectSummary
from exoscope.project.record import new_project

DEFAULT_DIR = Path(__file__).resolve().parents[3] / "projects"
DEFAULT_NAME = "New Project"
_ID = re.compile(r"^p-[0-9a-f]{8}$")


def projects_dir() -> Path:
    configured = os.environ.get("EXOSCOPE_PROJECTS_DIR")
    return Path(configured).expanduser() if configured else DEFAULT_DIR


class ProjectStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def _path(self, project_id: str) -> Path:
        if not _ID.match(project_id):
            raise ProjectNotFoundError(f"There is no Project {project_id!r}.")
        return self.root / f"{project_id}.json"

    def create(self, name: str | None, *, now: datetime) -> Project:
        project_id = f"p-{secrets.token_hex(4)}"
        while self._path(project_id).exists():
            project_id = f"p-{secrets.token_hex(4)}"
        project = new_project(project_id, (name or "").strip() or DEFAULT_NAME, now)
        self.save(project)
        return project

    def load(self, project_id: str) -> Project:
        path = self._path(project_id)
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            raise ProjectNotFoundError(f"There is no Project {project_id!r}.") from None
        except UnicodeDecodeError:
            raise ProjectCorruptError(
                f"Project {project_id!r} could not be read: {path.name} is not text."
            ) from None
        try:
            return Project.model_validate_json(text)
        except ValidationError as exc:
            raise ProjectCorruptError(
                f"Project {project_id!r} could not be read: its file {path.name} is damaged "
                f"({exc.error_count()} problem(s), first: {exc.errors()[0]['msg']})."
            ) from None

    def save(self, project: Project) -> None:
        path = self._path(project.id)
        self.root.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".json.tmp")
        temporary.write_text(project.model_dump_json(indent=1), encoding="utf-8")
        temporary.replace(path)

    def list(self) -> list[ProjectSummary]:
        if not self.root.is_dir():
            return []
        summaries = [self._summary(f.stem) for f in self.root.glob("p-*.json") if _ID.match(f.stem)]
        return sorted(
            summaries,
            key=lambda s: s.updated_at.timestamp() if s.updated_at else float("-inf"),
            reverse=True,
        )

    def _summary(self, project_id: str) -> ProjectSummary:
        try:
            p = self.load(project_id)
        except (ProjectCorruptError, ProjectNotFoundError) as exc:
            return ProjectSummary(
                id=project_id, name=project_id, updated_at=None, item_count=None, error=str(exc)
            )
        return ProjectSummary(
            id=p.id, name=p.name, updated_at=p.updated_at, item_count=p.item_count
        )
