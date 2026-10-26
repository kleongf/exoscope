"""Resolve canonical saved item IDs without expanding the requested scope."""

from dataclasses import dataclass

from exoscope.catalog import System
from exoscope.project.models import (
    ComparisonItem,
    Project,
    SampleItem,
    SystemItem,
    TurnRecord,
    WebSourceItem,
)
from exoscope.report.models import ReportInclude


class ReportError(Exception):
    """A Report cannot be written from the requested saved evidence."""


@dataclass
class Evidence:
    system_items: list[SystemItem]
    comparisons: list[ComparisonItem]
    samples: list[SampleItem]
    sources: list[WebSourceItem]
    turns: list[TurnRecord]
    included: tuple[str, ...]

    @property
    def systems(self) -> list[System]:
        return [item.system for item in self.system_items]


def _take[V](available: dict[str, V], identifiers: list[str], kind: str) -> list[V]:
    unknown = [identifier for identifier in identifiers if identifier not in available]
    if unknown:
        raise ReportError(f"Unknown saved {kind}: {', '.join(unknown)}. No Report was written.")
    return [available[key] for key in dict.fromkeys(identifiers)]


def select(project: Project, include: ReportInclude) -> Evidence:
    systems = _take({s.id: s for s in project.systems}, include.systems, "System")
    comparisons = _take({c.id: c for c in project.comparisons}, include.comparisons, "comparison")
    samples = _take({s.id: s for s in project.samples}, include.samples, "Sample")
    sources = _take({s.id: s for s in project.web_sources}, include.web_sources, "Web source")
    included = tuple(s.id for items in (systems, comparisons, samples, sources) for s in items)
    return Evidence(systems, comparisons, samples, sources, project.turns, included)
