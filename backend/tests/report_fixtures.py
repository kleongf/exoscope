"""Saved Report evidence with asymmetric errors, missing values, limits and text."""

import json
from html.parser import HTMLParser
from pathlib import Path
from typing import cast

import pytest

from exoscope.catalog.models import LiveProvenance, Measured, Missing, Reference
from exoscope.catalog.sample_models import (
    Exclusion,
    Filter,
    Interpretation,
    Sample,
    SampleField,
    SamplePlanet,
    TextValue,
)
from exoscope.compare import compare
from exoscope.project import Project, ProjectStore, StepRecord, record_turn
from exoscope.report.models import ReportInclude, ReportRequest, ReportSnapshot
from exoscope.report.service import export_report, report_path
from tests.project_fakes import T0, web_search
from tests.test_turn import offline_system

PNG = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4"
    "nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
)


def measured(value: float = 1.25) -> Measured:
    return Measured(
        value=value,
        unit="Earth radii",
        err_lo=0.12,
        err_hi=0.34,
        limit=None,
        reference=Reference(label="Paper <one>", url="https://example.org/paper"),
    )


@pytest.fixture
def saved_project(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Project:
    monkeypatch.setenv("EXOSCOPE_PROJECTS_DIR", str(tmp_path))
    store = ProjectStore(tmp_path)
    project = store.create("Saved science", now=T0)
    first, second = offline_system("TRAPPIST-1"), offline_system("TOI-700")
    second.provenance = LiveProvenance(source="NASA archive", fetched_at=T0)
    first.planets[0].radius = measured(9.12345)
    comparison = compare([first, second], "radius", "insolation")
    sample = Sample(
        filters=[Filter(field="radius", op="<", value=2)],
        interpretations=[
            Interpretation.model_validate(
                {
                    "term": "small",
                    "as": "radius under 2 Earth radii",
                    "caveat": "Size alone establishes no habitability",
                }
            )
        ],
        sort=None,
        limit=10,
        fields=[
            SampleField(name="radius", label="Radius", unit="Earth radii"),
            SampleField(name="orbital_period", label="Period", unit="days"),
            SampleField(name="discovery_method", label="Method", unit=None),
        ],
        planets=[
            SamplePlanet(
                name="Sample b",
                hostname="Sample",
                values={
                    "radius": measured(),
                    "orbital_period": measured(4.56),
                    "discovery_method": TextValue(value="Transit", reference=measured().reference),
                },
            ),
            SamplePlanet(
                name="Sample c",
                hostname="Sample",
                values={"radius": Missing(unit="Earth radii"), "orbital_period": measured(6.78)},
            ),
            SamplePlanet(
                name="Sample d",
                hostname="Sample",
                values={
                    "radius": measured().model_copy(update={"limit": "upper"}),
                    "orbital_period": measured(9.87),
                },
            ),
        ],
        matched=15,
        truncated=True,
        excluded=Exclusion(count=4, by_field={"radius": 4}, reason="missing radius"),
        provenance=first.provenance,
        notes=["Saved Sample note"],
    )

    def step(name: str, detail: str) -> StepRecord:
        return StepRecord(name=name, status="completed", detail=detail, elapsed_ms=12.5)

    record_turn(
        project,
        "Open TRAPPIST-1",
        "Loaded",
        now=T0,
        system=first,
        steps=[step("load_system", "Loaded TRAPPIST-1.")],
    )
    record_turn(
        project,
        "Compare radius",
        "Compared",
        now=T0,
        comparison=comparison,
        steps=[step("compare", "Seven radius rows")],
    )
    record_turn(
        project,
        "Find small planets",
        "Found",
        now=T0,
        sample=sample,
        steps=[step("search_catalog", "Saved small planets")],
    )
    record_turn(
        project,
        "Search sources",
        "Cited",
        now=T0,
        web_search=web_search("https://example.org/water"),
        steps=[step("web_search", "Found source")],
    )
    store.save(project)
    assert project.systems[0].id == "sys-2"
    assert project.comparisons[0].id == "cmp-4"
    assert project.samples[0].id == "smp-6"
    assert project.web_sources[0].id == "web-8"
    return project


def store() -> ProjectStore:
    from exoscope.project import projects_dir

    return ProjectStore(projects_dir())


def snapshot(hostname: str = "TRAPPIST-1") -> ReportSnapshot:
    return ReportSnapshot(hostname=hostname, data_url=PNG, captured_at="2026-10-25T23:00:00Z")


def write(project: Project, include: ReportInclude) -> Project:
    return export_report(
        project,
        store(),
        ReportRequest(title="Evidence Report", include=include, snapshot=snapshot()),
    )


def html(project: Project, index: int = -1) -> str:
    return report_path(store(), project.reports[index].file).read_text(encoding="utf-8")


class Document(HTMLParser):
    def __init__(self, html: str) -> None:
        super().__init__()
        self.evidence = ""
        self.text: list[str] = []
        self.tags: list[tuple[str, dict[str, str | None]]] = []
        self.in_evidence = False
        self.feed(html)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.tags.append((tag, dict(attrs)))
        if tag == "script" and dict(attrs).get("id") == "saved-evidence":
            self.in_evidence = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.in_evidence = False

    def handle_data(self, data: str) -> None:
        self.text.append(data)
        if self.in_evidence:
            self.evidence += data

    def data(self) -> dict[str, object]:
        return cast(dict[str, object], json.loads(self.evidence))
