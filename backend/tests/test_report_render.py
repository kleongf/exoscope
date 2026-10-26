"""Reports preserve selected saved evidence and use safe self-contained offline assets."""

import json
from html import unescape
from pathlib import Path
from typing import cast

import pytest

from exoscope.catalog.models import Measured
from exoscope.project.models import Project
from exoscope.report import charts
from exoscope.report.models import ReportInclude, ReportRequest
from exoscope.report.selection import ReportError
from exoscope.report.service import export_report
from tests.report_fixtures import (
    PNG,
    Document,
    saved_project,
    snapshot,
    store,
    write,
)
from tests.report_fixtures import (
    html as report_html,
)

__all__ = ["saved_project"]


def test_every_saved_quantity_and_scope_is_exact(saved_project: Project) -> None:
    include = ReportInclude(
        systems=["sys-2"], comparisons=["cmp-4"], samples=["smp-6"], web_sources=["web-8"]
    )
    updated = write(saved_project, include)
    document = Document(report_html(updated))
    assert document.data() == {
        "systems": [saved_project.systems[0].model_dump(mode="json")],
        "comparisons": [saved_project.comparisons[0].model_dump(mode="json")],
        "samples": [saved_project.samples[0].model_dump(mode="json")],
        "web_sources": [saved_project.web_sources[0].model_dump(mode="json")],
        "included": ["sys-2", "cmp-4", "smp-6", "web-8"],
    }
    text = unescape(report_html(updated))
    for value in (
        "9.12345",
        "0.12",
        "0.34",
        "Missing",
        "upper limit",
        "Paper <one>",
        "Transit",
        "Sample b",
        "Sample c",
        "Sample d",
        "radius under 2 Earth radii",
        "missing radius",
        "Live · fetched",
        "Cached · Snapshot",
        "pscomppars",
        "not be mutually consistent",
        "do not establish",
        "TTVs ignored",
    ):
        assert value in text
    assert PNG in report_html(updated)
    assert "<ol>" in report_html(updated) and "Seven radius rows" in report_html(updated)
    assert "Unselected evidence" not in report_html(
        updated
    ) and "Unselected mass comparison" not in report_html(updated)
    assert "Tool call: load_system" in report_html(updated)
    assert "<pre>" not in report_html(updated)


def test_distinct_scopes_never_expand_to_other_saved_items(saved_project: Project) -> None:
    first = write(saved_project, ReportInclude(comparisons=["cmp-4"]))
    second = write(first, ReportInclude(samples=["smp-6"]))
    first_data = Document(report_html(first, 0)).data()
    second_data = Document(report_html(second, 1)).data()
    assert first_data["samples"] == [] and first_data["systems"] == []
    assert second_data["comparisons"] == [] and second_data["web_sources"] == []
    assert "Sample b" not in report_html(first, 0)
    assert "System view snapshot unavailable" in report_html(second, 1)
    assert PNG not in report_html(second, 1)
    assert "Retrieved Web sources" not in report_html(first, 0)


def test_offline_runtime_and_chart_values_are_embedded(saved_project: Project) -> None:
    html = report_html(write(saved_project, ReportInclude(comparisons=["cmp-4"])))
    document = Document(html)
    for tag, attrs in document.tags:
        assert not (tag == "script" and "src" in attrs)
        assert not (tag == "link" and "href" in attrs)
    assert "plotly.js" in html and "connect-src 'none'" in html
    start = html.index('Plotly.newPlot("chart-cmp-4",') + len('Plotly.newPlot("chart-cmp-4",')
    data, _ = json.JSONDecoder().raw_decode(html[start:])
    traces = cast(list[dict[str, object]], data)
    rows = saved_project.comparisons[0].comparison.plotted
    xs = [r.x for r in rows if isinstance(r.x, Measured)]
    ys = [r.y for r in rows if isinstance(r.y, Measured)]
    assert len(xs) == len(ys) == len(rows)
    assert traces[0]["x"] == [q.value for q in xs]
    assert traces[0]["y"] == [q.value for q in ys]
    assert traces[0]["error_x"] == {
        "type": "data",
        "symmetric": False,
        "array": [q.err_hi for q in xs],
        "arrayminus": [q.err_lo for q in xs],
    }


def test_missing_runtime_fails_without_mutation(
    saved_project: Project, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    before = (tmp_path / f"{saved_project.id}.json").read_bytes()

    def absent(_: Path) -> bool:
        return False

    monkeypatch.setattr(Path, "is_file", absent)
    with pytest.raises(ReportError, match="local Plotly runtime"):
        charts.runtime()
    with pytest.raises(ReportError, match="local Plotly runtime"):
        write(saved_project, ReportInclude(comparisons=["cmp-4"]))
    assert (tmp_path / f"{saved_project.id}.json").read_bytes() == before
    # A Web-source-only Report has no chart dependency.
    assert write(saved_project, ReportInclude(web_sources=["web-8"])).reports


def test_untrusted_text_urls_json_and_snapshot_are_safe(saved_project: Project) -> None:
    attack = '</script><script>alert("unsafe")</script><img src=x onerror=alert(1)>'
    saved_project.name = attack
    saved_project.comparisons[0].comparison.rows[0].planet = attack
    source = saved_project.web_sources[0]
    source.title, source.url, source.domain = attack, "javascript:alert(1)", attack
    result = export_report(
        saved_project,
        store(),
        ReportRequest(
            title=attack,
            include=ReportInclude(comparisons=["cmp-4"], web_sources=["web-8"]),
            summary=attack,
            limitations=attack,
        ),
    )
    html = report_html(result)
    document = Document(html)
    assert attack not in html
    assert document.data()["web_sources"] == [source.model_dump(mode="json")]
    for tag, attrs in document.tags:
        assert not any(attr.startswith("on") for attr in attrs)
        if "href" in attrs:
            assert str(attrs["href"]).startswith(("https://", "http://"))
        assert tag != "img"
    assert "\\u003c/script" in document.evidence


def test_unknown_turn_never_invents_tool_associations(saved_project: Project) -> None:
    saved_project.comparisons[0].turn_id = "turn-missing"
    saved_project.samples[0].turn_id = "turn-missing"
    html = report_html(
        write(saved_project, ReportInclude(comparisons=["cmp-4"], samples=["smp-6"]))
    )
    assert "comparison cmp-4: associated tool step unavailable" in html
    assert "Sample smp-6: associated tool step unavailable" in html
    assert "Seven radius rows" not in html and "Saved small planets" not in html


@pytest.mark.parametrize(
    "hostname,data", [("Unknown", PNG), ("TRAPPIST-1", "data:image/png;base64,bad")]
)
def test_mismatched_or_invalid_png_is_unavailable(
    saved_project: Project, hostname: str, data: str
) -> None:
    image = snapshot(hostname).model_copy(update={"data_url": data})
    result = export_report(
        saved_project,
        store(),
        ReportRequest(
            title="No image", include=ReportInclude(comparisons=["cmp-4"]), snapshot=image
        ),
    )
    html = report_html(result)
    assert "System view snapshot unavailable" in html
    assert not any(tag == "img" for tag, _ in Document(html).tags)


def test_sample_renders_values_without_field_descriptors(saved_project: Project) -> None:
    saved_project.samples[0].sample.fields.clear()
    html = report_html(write(saved_project, ReportInclude(samples=["smp-6"])))
    for value in ("Sample b", "Transit", "Paper &lt;one&gt;", "1.25", "0.12", "0.34"):
        assert value in html
    assert "fewer than two numeric axes" in html
