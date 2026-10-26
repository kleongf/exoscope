"""Immutable HTML survives later Project work, restarts and failed writes."""

import hashlib
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from pydantic import ValidationError

from exoscope.project import Project
from exoscope.report.models import ReportInclude, ReportRequest
from exoscope.report.routes import write_report
from exoscope.report.selection import ReportError
from exoscope.report.service import export_report, report_path
from tests.report_fixtures import PNG, html, saved_project, snapshot, store, write

__all__ = ["saved_project"]


def test_immutable_after_edit_later_export_and_process_restart(saved_project: Project) -> None:
    first = write(saved_project, ReportInclude(comparisons=["cmp-4"]))
    before = html(first)
    assert first.reports[0].written_at.isoformat() in before
    first.comparisons.clear()
    first.systems[0].system.notes.append("Later change")
    first.name = "Changed Project"
    store().save(first)
    second = write(first, ReportInclude(systems=["sys-2"]))
    assert html(second, 0) == before and "Later change" in html(second)
    assert '"html"' not in (store().root / f"{second.id}.json").read_text()
    restarted = subprocess.run(
        [
            sys.executable,
            "-c",
            "import hashlib,sys; from pathlib import Path; "
            "from exoscope.project import ProjectStore; s=ProjectStore(Path(sys.argv[1])); "
            "p=s.load(sys.argv[2]); print(len(p.reports)); "
            "print(hashlib.sha256((s.root/'reports'/p.reports[0].file).read_bytes()).hexdigest())",
            str(store().root),
            second.id,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    assert restarted.stdout.splitlines() == ["2", hashlib.sha256(before.encode()).hexdigest()]


@pytest.mark.parametrize(
    "include",
    [
        {"comparisons": ["cmp-404"]},
        {"samples": ["smp-404"]},
        {"systems": ["TRAPPIST-1"]},
        {"web_sources": ["s0"]},
        {"comparisons": ["cmp-4", "cmp-404"]},
    ],
)
def test_unknown_scope_writes_nothing(saved_project: Project, include: dict[str, object]) -> None:
    before = (store().root / f"{saved_project.id}.json").read_bytes()
    with pytest.raises(ReportError, match="Unknown saved"):
        write(saved_project, ReportInclude.model_validate(include))
    assert (store().root / f"{saved_project.id}.json").read_bytes() == before
    assert not list(store().root.glob("reports/*"))


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "Report", "include": {}},
        {"title": " ", "include": {"comparisons": ["cmp-4"]}},
        {"title": "Report", "include": {"samples": [42]}},
        {"title": "Report", "include": {"comparisons": [True]}},
        {"title": "Report", "include": {"comparisons": ["cmp-4"]}, "measurements": [100]},
        {"title": "Report", "include": {"systems": ["sys-2"], "everything": True}},
    ],
)
def test_invalid_or_empty_arguments_rejected(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        ReportRequest.model_validate(payload)


def test_competing_manual_exports_preserve_both(saved_project: Project) -> None:
    request = ReportRequest(title="Concurrent", include=ReportInclude(samples=["smp-6"]))

    def attempt(_: int) -> Project:
        return write_report(saved_project.id, request, store())

    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(attempt, range(2)))
    current = store().load(saved_project.id)
    assert len(current.reports) == 2
    assert len({r.file for r in current.reports}) == 2


@pytest.mark.parametrize("fail_at", ["metadata", "html"])
def test_write_failure_rolls_back_file_and_metadata(
    saved_project: Project, monkeypatch: pytest.MonkeyPatch, fail_at: str
) -> None:
    first = write(saved_project, ReportInclude(samples=["smp-6"]))
    before_html, before = html(first), first.model_copy(deep=True)
    saved_store = store()

    def fail(*_: object, **__: object) -> None:
        raise OSError("Disk full")

    if fail_at == "metadata":
        monkeypatch.setattr(saved_store, "save", fail)
    else:
        monkeypatch.setattr(Path, "write_text", fail)
    with pytest.raises(ReportError, match="storage is unavailable"):
        export_report(
            first,
            saved_store,
            ReportRequest(title="Fails", include=ReportInclude(samples=["smp-6"])),
        )
    assert first == before and saved_store.load(first.id) == before
    assert html(first) == before_html
    assert len(list((saved_store.root / "reports").iterdir())) == 1


@pytest.mark.parametrize("filename", ["../secret", "report-foo.html", "/tmp/file", "x.html"])
def test_report_path_rejects_unsafe_names(filename: str) -> None:
    with pytest.raises(ReportError):
        report_path(store(), filename)


def test_report_metadata_copies_manual_request(saved_project: Project) -> None:
    request = ReportRequest(title="Scoped request", include=ReportInclude(comparisons=["cmp-4"]))
    result = export_report(saved_project, store(), request)
    report = result.reports[-1]
    assert ReportRequest.model_validate_json(report.request) == request
    request.include.comparisons.clear()
    assert report.includes == ["cmp-4"]


def test_snapshot_is_copied_only_into_html(saved_project: Project) -> None:
    request = ReportRequest(
        title="With image",
        include=ReportInclude(systems=["sys-2"]),
        summary="Student request body",
        snapshot=snapshot(),
    )
    updated = export_report(saved_project, store(), request)
    metadata = (store().root / f"{saved_project.id}.json").read_text()
    assert PNG in html(updated) and PNG not in metadata
    copied_request = ReportRequest.model_validate_json(updated.reports[-1].request)
    assert copied_request.title == request.title and copied_request.summary == request.summary
    assert copied_request.snapshot is None
