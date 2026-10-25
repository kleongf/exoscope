"""Add a turn's results to a Project. Work builds up; opening a System never removes anything."""

from collections.abc import Sequence
from datetime import datetime

from exoscope.catalog import Sample, System
from exoscope.compare import Comparison
from exoscope.project.models import (
    ComparisonItem,
    Project,
    ReportRecord,
    SampleItem,
    StepRecord,
    SystemItem,
    TurnRecord,
)


def new_project(project_id: str, name: str, now: datetime) -> Project:
    return Project(id=project_id, name=name, created_at=now, updated_at=now)


def _next_id(project: Project, prefix: str) -> str:
    n = project.next_seq
    project.next_seq += 1
    return f"{prefix}-{n}"


def record_turn(  # noqa: PLR0913 — one keyword per kind of result a turn can produce
    project: Project,
    transcript: str,
    reply_text: str,
    *,
    now: datetime,
    error: str | None = None,
    steps: Sequence[StepRecord] = (),
    system: System | None = None,
    comparison: Comparison | None = None,
    sample: Sample | None = None,
) -> TurnRecord:
    turn = TurnRecord(
        id=_next_id(project, "turn"),
        at=now,
        transcript=transcript,
        reply_text=reply_text,
        error=error,
        steps=list(steps),
    )
    project.turns.append(turn)
    if system is not None:
        _open_system(project, system, turn.id, now)
    if comparison is not None:
        item = ComparisonItem(
            id=_next_id(project, "cmp"), turn_id=turn.id, made_at=now, comparison=comparison
        )
        project.comparisons.append(item)
    if sample is not None:
        item = SampleItem(id=_next_id(project, "smp"), turn_id=turn.id, ran_at=now, sample=sample)
        project.samples.append(item)
    project.updated_at = now
    return turn


def _open_system(project: Project, system: System, turn_id: str, now: datetime) -> None:
    existing = next((s for s in project.systems if s.system.hostname == system.hostname), None)
    if existing is None:
        item = SystemItem(
            id=_next_id(project, "sys"), turn_id=turn_id, opened_at=now, system=system
        )
        project.systems.append(item)
    else:
        existing.system, existing.turn_id, existing.opened_at = system, turn_id, now
    project.current_system = system.hostname


def record_report(
    project: Project,
    *,
    title: str,
    request: str,
    includes: Sequence[str],
    file: str,
    now: datetime,
) -> ReportRecord:
    report = ReportRecord(
        id=_next_id(project, "rep"),
        title=title,
        request=request,
        written_at=now,
        includes=list(includes),
        file=file,
    )
    project.reports.append(report)
    project.updated_at = now
    return report
