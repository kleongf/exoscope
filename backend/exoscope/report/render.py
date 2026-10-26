"""Scientific-paper Report: template evidence and explicitly labelled model prose."""

import base64
from html import escape
from typing import cast

from exoscope.project.models import Project
from exoscope.report.charts import chart, runtime
from exoscope.report.html import link, safe_json
from exoscope.report.log import tool_log
from exoscope.report.models import ReportRequest, ReportSnapshot
from exoscope.report.sample import axes, chart_status, method, sample_chart
from exoscope.report.selection import Evidence
from exoscope.report.tables import comparison_table, object_table, provenance, sample_table

STYLE = """
body{font:16px Georgia,serif;max-width:1100px;margin:3rem auto;padding:0 1rem;color:#17212b}
table{border-collapse:collapse;width:100%;margin:1rem 0;font:14px system-ui;
display:block;overflow:auto}
th,td{border:1px solid #cad2db;padding:.55rem;text-align:left;vertical-align:top}
small{color:#41536a}img{max-width:100%;background:#05060a}section{margin:2rem 0}
a{color:#1564a0}.chart{width:100%;height:400px}li{margin:.5rem 0}
.prose{background:#f4edff;border-left:4px solid #8052ab;padding:1rem;white-space:pre-wrap}
mark{background:#fff2bc;color:inherit}
.figures{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:1rem}
@media(max-width:700px){.figures{display:block}table{display:block;overflow:auto}}
@media print{body{margin:0;max-width:none}a{color:inherit}.chart,img{break-inside:avoid}}
"""
LIMITATIONS = (
    "NASA Exoplanet Archive pscomppars values may come from different source papers and "
    "may not be mutually consistent. Missing values remain missing. Archive measurements "
    "do not establish surface liquid water, atmospheres or habitability. Web sources are "
    "distinct from archive measurements and never supply plotted values. The System view is "
    "edge-on from Earth; positions are extrapolated from transit epochs, TTVs ignored, "
    "planet sizes may be enlarged, and the line of nodes is assumed. It is not an N-body "
    "simulation. A saved System view snapshot is not a current observation."
)


def snapshot(image: ReportSnapshot | None, evidence: Evidence) -> str:
    saved = image.model_dump() if image else None
    hosts = {system.hostname for system in evidence.systems}
    hosts.update(p.hostname for c in evidence.comparisons for p in c.comparison.provenance)
    if isinstance(saved, dict):
        hostname = saved.get("hostname")
        if not isinstance(hostname, str) or hostname not in hosts:
            return "<p>System view snapshot unavailable for the selected evidence.</p>"
        data, captured = saved.get("data_url"), saved.get("captured_at")
        if (
            isinstance(data, str)
            and isinstance(captured, str)
            and captured.strip()
            and data.startswith("data:image/png;base64,")
            and len(data) <= 6_000_000
        ):
            try:
                valid = base64.b64decode(data.split(",", 1)[1], validate=True).startswith(
                    b"\x89PNG\r\n\x1a\n"
                )
            except ValueError:
                valid = False
            if valid:
                return (
                    f'<img alt="Saved System view" src="{escape(data, quote=True)}">'
                    f"<p>{escape(str(saved['hostname']))} · captured {escape(captured)}</p>"
                    + (
                        f"<p>Simulated epoch: JD {saved['simulated_julian_date']} day "
                        "(saved scene readout).</p>"
                        if type(saved.get("simulated_julian_date")) in (int, float)
                        else ""
                    )
                )
    return "<p>System view snapshot unavailable for the selected evidence.</p>"


def saved_data(evidence: Evidence) -> dict[str, object]:
    return {
        "systems": [s.model_dump(mode="json") for s in evidence.system_items],
        "comparisons": [s.model_dump(mode="json") for s in evidence.comparisons],
        "samples": [s.model_dump(mode="json") for s in evidence.samples],
        "web_sources": [s.model_dump(mode="json") for s in evidence.sources],
        "included": evidence.included,
    }


def _papers(value: object) -> list[tuple[str, str | None]]:
    if isinstance(value, dict):
        record = cast(dict[str, object], value)
        reference = record.get("reference")
        if isinstance(reference, dict):
            ref = cast(dict[str, object], reference)
            label, url = ref.get("label"), ref.get("url")
            if isinstance(label, str):
                return [(label, url if isinstance(url, str) else None)]
        return [paper for child in record.values() for paper in _papers(child)]
    if isinstance(value, list):
        children = cast(list[object], value)
        return [paper for child in children for paper in _papers(child)]
    return []


def _results(evidence: Evidence) -> str:
    sections: list[str] = []
    for system in evidence.systems:
        body = f"<p>{provenance(system.provenance)}</p><h4>Star</h4>" + object_table(system.star)
        body += "".join(f"<h4>{escape(p.name)}</h4>{object_table(p)}" for p in system.planets)
        body += "".join(f"<p>{escape(note)}</p>" for note in system.notes)
        sections.append(f"<h3>System: {escape(system.hostname)}</h3>{body}")
    for saved in evidence.comparisons:
        comparison = saved.comparison
        stamps = "".join(
            f"<li>{escape(p.hostname)} · {provenance(p.provenance)}</li>"
            for p in comparison.provenance
        )
        sections.append(
            f"<h3>Comparison {saved.id}: {escape(comparison.y.label)} "
            f"vs {escape(comparison.x.label)}</h3>"
            f"{comparison_table(comparison)}"
            f"<ul>{stamps}</ul>" + "".join(f"<p>{escape(note)}</p>" for note in comparison.notes)
        )
    for saved in evidence.samples:
        statuses = [chart_status(saved.sample, dict(p.values)) for p in saved.sample.planets]
        sections.append(
            f"<h3>Sample {saved.id}</h3>"
            f"{sample_table(saved.sample, statuses)}"
            f"<p>{provenance(saved.sample.provenance)}</p>"
            + "".join(f"<p>{escape(note)}</p>" for note in saved.sample.notes)
        )
    return "".join(sections)


def _method(evidence: Evidence) -> str:
    lines = [
        f"<p>System {escape(s.hostname)} · {provenance(s.provenance)} "
        f"· {len(s.planets)} planets</p>"
        for s in evidence.systems
    ]
    for saved in evidence.comparisons:
        c = saved.comparison
        lines.append(
            f"<p>Comparison {saved.id}: {len(c.plotted)} plotted; {len(c.excluded)} excluded; "
            "±1 sigma asymmetric error bars where saved.</p>"
        )
    lines += [f"<h3>Sample {s.id}</h3>{method(s.sample)}" for s in evidence.samples]
    if evidence.systems or evidence.comparisons or evidence.samples:
        lines.insert(
            0,
            "<p>Archive table: NASA Exoplanet Archive pscomppars. Saved measurements only; "
            "no data were refreshed for this Report.</p>",
        )
    return "".join(lines)


def _figures(request: ReportRequest, evidence: Evidence) -> str:
    plots = [
        f"<h3>Comparison {s.id}</h3>{chart(s.comparison, f'chart-{s.id}')}"
        for s in evidence.comparisons
    ]
    plots += [
        f"<h3>Sample {s.id}</h3>{sample_chart(s.sample, f'sample-{s.id}')}"
        for s in evidence.samples
    ]
    image = f"<aside><h3>System view snapshot</h3>{snapshot(request.snapshot, evidence)}</aside>"
    return f'<div class="figures"><div>{"".join(plots)}</div>{image}</div>' if plots else image


def _badge(evidence: Evidence) -> str:
    stamps = [s.provenance for s in evidence.systems]
    stamps += [p.provenance for c in evidence.comparisons for p in c.comparison.provenance]
    stamps += [s.sample.provenance for s in evidence.samples]
    labels = dict.fromkeys("Live" if p.mode == "live" else "Cached" for p in stamps)
    return " / ".join(labels) if labels else "Web evidence"


def render(
    project: Project,
    request: ReportRequest,
    evidence: Evidence,
    created_at: str,
    *,
    gemma: bool = False,
) -> str:
    data = saved_data(evidence)
    papers = dict.fromkeys(_papers(data))
    references = "".join(f"<li>{link(label, url)}</li>" for label, url in papers)
    sources = "".join(
        f"<li>{link(s.title, s.url)} · {escape(s.domain)} "
        f"· retrieved {escape(s.retrieved_at.isoformat())}</li>"
        for s in evidence.sources
    )
    scripts = (
        runtime()
        if evidence.comparisons or any(len(axes(s.sample)) == 2 for s in evidence.samples)
        else ""
    )
    included = ", ".join(evidence.included)
    origin = "Written by Gemma · not number-checked" if gemma else "Student/template narrative"
    summary, _, results = request.summary.partition("\n\n") if gemma else (request.summary, "", "")
    results_prose = (
        f'<p class="prose"><small>{origin}</small><br>{escape(results)}</p>'
        if gemma and results
        else ""
    )
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; '
        "script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; "
        "font-src data:; connect-src 'none'\">"
        f"<title>{escape(request.title)}</title><style>{STYLE}</style>{scripts}</head><body>"
        f"<h1>{escape(request.title)}</h1><p>Project: {escape(project.name)} "
        f"· Written {escape(created_at)} UTC · {_badge(evidence)}</p>"
        "<p><mark>Highlighted values</mark> come from saved evidence. "
        f"Purple boxes: {origin}.</p>"
        f"<section><h2>Summary</h2><p>Included: {escape(included)}</p>"
        f'<div class="prose">{escape(summary)}</div></section>'
        f"<section><h2>Data and method</h2>{_method(evidence)}</section>"
        f"<section><h2>Results</h2>{_figures(request, evidence)}{_results(evidence)}"
        f"{results_prose}</section>"
        f"<section><h2>Limitations</h2><p>{LIMITATIONS}</p>"
        f'<div class="prose">{escape(request.limitations)}</div></section>'
        f"<section><h2>References · source papers</h2><ul>{references}</ul></section>"
        f"<section><h2>Web sources</h2><ul>{sources}</ul></section>"
        f"<section><h2>Appendix: tool-call log</h2>{tool_log(evidence)}</section>"
        f'<script id="saved-evidence" type="application/json">{safe_json(data)}</script>'
        "</body></html>"
    )
