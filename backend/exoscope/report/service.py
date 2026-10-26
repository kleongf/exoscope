"""Render once to an HTML file; the canonical Project keeps metadata only."""

import os
import re
from contextlib import suppress
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from exoscope.project import Project, ProjectStore, record_report
from exoscope.report.locking import PROJECT_WRITES
from exoscope.report.models import ReportRequest
from exoscope.report.render import render
from exoscope.report.selection import ReportError, select

_FILENAME = re.compile(r"report-[0-9a-f]{32}\.html\Z")


def reports_dir(store: ProjectStore) -> Path:
    configured = os.environ.get("EXOSCOPE_REPORTS_DIR")
    return Path(configured).expanduser() if configured else store.root / "reports"


def report_path(store: ProjectStore, filename: str) -> Path:
    if not _FILENAME.fullmatch(filename):
        raise ReportError("Unknown Report file.")
    return reports_dir(store) / filename


def export_report(
    project: Project,
    store: ProjectStore,
    request: ReportRequest,
    *,
    original_request: str | None = None,
    model_written: bool = False,
) -> Project:
    with PROJECT_WRITES:
        evidence = select(project, request.include)
        written_at = datetime.now(UTC)
        html = render(
            project, request, evidence, written_at.isoformat(), model_written=model_written
        )
        path = report_path(store, f"report-{uuid4().hex}.html")
        temporary = path.with_suffix(".tmp")
        old_seq, old_updated, old_count = project.next_seq, project.updated_at, len(project.reports)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary.write_text(html, encoding="utf-8")
            temporary.replace(path)
            record_report(
                project,
                title=request.title,
                request=original_request
                if original_request is not None
                else request.model_dump_json(exclude={"snapshot"}),
                includes=evidence.included,
                file=path.name,
                now=written_at,
            )
            store.save(project)
        except (OSError, UnicodeError) as exc:
            del project.reports[old_count:]
            project.next_seq, project.updated_at = old_seq, old_updated
            for leftover in (temporary, path):
                with suppress(OSError):
                    leftover.unlink(missing_ok=True)
            raise ReportError("Report storage is unavailable; no Report was saved.") from exc
        return project
