"""Bind the very same Project object that the turn recorder will save."""

from collections.abc import Generator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

from exoscope.project import Project, ProjectStore
from exoscope.report.models import ReportSnapshot
from exoscope.report.selection import ReportError


@dataclass
class ReportContext:
    project: Project
    store: ProjectStore
    request: str
    snapshot: ReportSnapshot | None = None


ACTIVE_PROJECT: ContextVar[ReportContext | None] = ContextVar("report_project", default=None)


@contextmanager
def bind_project(
    project: Project | None,
    store: ProjectStore | None = None,
    request: str = "",
    snapshot: ReportSnapshot | None = None,
) -> Generator[ReportContext | None]:
    context = ReportContext(project, store, request, snapshot) if project and store else None
    token = ACTIVE_PROJECT.set(context)
    try:
        yield context
    finally:
        ACTIVE_PROJECT.reset(token)


def active_project() -> ReportContext:
    context = ACTIVE_PROJECT.get()
    if context is None:
        raise ReportError(
            "Choose and save a Project before listing evidence or exporting a Report."
        )
    return context
