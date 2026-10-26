# Reports

Ask “Write a report on the TRAPPIST-1 radius comparison”, or choose **Write Report** in the
Project explorer. Pick saved Systems, comparisons, Samples and Web sources. Each export
creates one new immutable HTML file; Open Report opens it in a new tab and Download HTML
saves the same self-contained document for offline use.

Gemma calls `list_project_items` to discover canonical saved item IDs, then `export_report`.
Unknown IDs and empty scopes fail honestly. The template supplies tables, chart values,
uncertainties, limits, missing values, units, source papers, provenance and tool logs from
saved evidence. Gemma supplies only summary/limitations prose; that prose is visibly
separate and is not fact-checked. Two summary paragraphs can supply Summary and short
Results prose. Manual exports label their prose as student/template narrative.

The scientific-paper layout includes title, Project and UTC write time, Live/Cached badge,
summary, data/method, figures beside a System view snapshot, data tables, limitations,
source-paper references, Web sources with retrieval times, and numbered tool-call logs.
The mandatory limitations state that `pscomppars` values can come from different papers.
A missing or scope-mismatched snapshot or historical tool association is explicitly unavailable.

The browser captures the rendered PNG before export and retries if the System or canvas
changes during capture. The snapshot is copied into HTML, never stored in Project metadata.
Plotly, chart JSON, CSS and images are embedded locally; exported files need no CDN or API.
All text, links and script data are escaped/validated, and the document blocks network access.

API:
- `POST /turn` carries `project_id` and optional `report_snapshot` for agent-driven Reports.
- `POST /projects/{id}/reports` accepts the same typed Report request for explicit manual scopes.
- `GET /reports/{filename}` opens immutable HTML; `?download=true` downloads it.

Files live in the Project store's `reports/` directory, overridable with `EXOSCOPE_REPORTS_DIR`.
The Project JSON stores only title, original request, included IDs, write time and filename.
Later Project edits, deleted evidence or additional Reports cannot change earlier HTML.
There is no Report edit operation; write another Report to change it.

Backend checks cover exact saved quantities/scopes, write failures, concurrent exports,
restart recovery, path safety, escaping, model failures and immutable files. Browser smoke
uses actual export routes, opens/downloads two different scopes, tests Plotly offline,
checks PNG pixels, and compares unchanged HTML after source changes and reload. Provider
and astronomy inputs are explicit fixtures; these checks do not claim live-model readiness.
