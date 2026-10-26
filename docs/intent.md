# ExoScope — Intent

The document every agent works from. Vocabulary is defined in [GLOSSARY.md](../GLOSSARY.md); use those terms exactly. The original long-form brief is [project-brief.md](project-brief.md) — background only; where it disagrees with this file, this file wins.

## What we are building

A voice-operated exoplanet research workbench. A student speaks (or types) a question; Gemma calls typed tools against **live** NASA Exoplanet Archive data; the **System view** (3D) and a linked chart update; everything the student builds up is kept in a **Project**, from which they can write any number of **Reports** with their evidence.

Hackathon: **about 4 hours, 2 people.** Tracks: Space/Cursor/Grok, Gemma, Open-source. Judging is from a **recorded demo video**, not a live demo; the video matters more than completeness.

## Who it is for

Students organising evidence-based work in Projects, with educators as the secondary user. Not researchers.

## What "good" looks like — the demo video (build backwards from this)

1. **"Open TRAPPIST-1."** — System loads live into the System view.
2. **"Speed up time / focus on planet e."** — scene changes via tool-issued `ui_commands`.
3. **"Compare radius and irradiation."** — one Plotly scatter + table; clicking a point focuses that planet.
4. **"Does any of these have liquid water?"** — the web-search beat: Gemma answers from archive fields, uses `web_search` because the archive cannot answer, and cites Web sources aloud. Rehearse twice; judged by citations being present.
5. **"Find small planets with periods under 10 days."** — live Sample search; Gemma states its Interpretation of "small" and it shows as an editable chip. Clicking a Sample point in another System loads that System live (~1.1 s) and focuses the planet.
6. **"Write a report on the radius comparison."** — one self-contained HTML Report covering that part of the Project, listed in the Project explorer.

Backup demo System if TRAPPIST-1 misbehaves: TOI-700 (not Kepler-186 — its eccentricities are placeholders).

## Settled decisions

**Product**
- Name: ExoScope.
- The System view shows exactly one System. Samples live only in the table/chart.
- Orbits (chosen from the `prototype/orbits` prototype, variant C "Honesty layers"): Keplerian ellipses at true relative scale, phase from transit epochs, in a tilted 3D view. Toggleable honesty layers: ±1σ orbit bands from the semi-major-axis error, ±2σ position spread growing with time since the transit epoch, assumption lines (line of nodes, Earth direction), and a true-sizes toggle. Hovering a planet shows its provenance ("N orbits since that epoch → position ±X°, TTVs ignored"). The scene shows no caveat captions (removed at the team's request as distracting); only the Live/Cached provenance badge stays. Limitations live in Reports.
- Push-to-talk voice (Grok STT/TTS) plus an always-visible text box; transcript always shown.
- Runs on localhost; the demo is recorded as a video (no deployment, no live presentation). Slow turns can be trimmed in the edit.
- Layout (chosen from the `prototype/turn-ui` prototype, variant A): Project explorer on the left, System view in the centre with the chart drawer beneath it, chat on the right. The selected planet's properties (values, units, source-paper tooltips) appear in a floating card in the top-right corner of the System view, closed when nothing is selected. Each chat answer shows its tool steps inline with timings while the turn runs, a Live/Cached badge, and on failure "Nothing in the view was changed."

**Projects**
- A Project organises work; it needs no research question. A student can have several Projects and switch between them; "New Project" starts an empty one.
- Each Project is saved by the backend as one JSON file, automatically after every turn, and survives a restart.
- Evidence, Systems opened, Samples, comparisons, Web sources and Reports build up across the Project; opening a new System only changes the System view.
- The left panel is the Project explorer (chosen from `prototype/project-explorer`, variant A "grouped list"): collapsible sections with counts, a Project switcher dropdown with "New Project" at the top of the panel, and Interpretation chips shown on each Sample (from variant C). Sections: Systems opened (click reloads), Samples with their Interpretation chips, comparisons (click reopens the chart), Web sources, and Reports (click opens in a new tab). Reports are the only files; students do not upload files.

**Data**
- Every query runs live against TAP (`pscomppars` only) with a ~5 s timeout; on failure fall back to a Snapshot. Each result is labelled "Live · fetched HH:MM" or "Cached · Snapshot YYYY-MM-DD". Measured latency: ~1.1–1.4 s per query.
- `pscomppars` mixes publications; the property tooltip shows each value's source paper, and the Report states values may not be mutually consistent.
- Canonical IDs are archive `pl_name` / `hostname`. Lookup is case/spacing-insensitive; ambiguous or unknown names return an explicit tool error — the agent never guesses.
- Filters use an allowlist of ~15 fields (radius, mass, period, semi-major axis, eccentricity, insolation, equilibrium temp, discovery year, discovery method, stellar Teff/radius/mass, distance) with operators `< <= > >= = between is_null`. The backend builds ADQL; the model never writes SQL or code.
- Known data quirks: `st_lum` is log10(L/Lsun); `pl_orblper` can fall outside [0, 360) — normalise mod 360; 28 rows lack `sy_dist`.

**Agent**
- Plain `google-genai` function-calling loop with Gemma 4 `gemma-4-26b-a4b-it` (one tool-call step ~3 s; `gemma-4-31b-it` measured ~17 s, too slow for voice). No ADK. Max 5 tool calls per turn.
- Vague words become Interpretations: Gemma picks one, says it aloud, it is passed as `interpretations` on `search_catalog`, shown as a chip, recorded in the Report. Loaded words ("Earth-like", "habitable") always carry a caveat.
- Tools (more may be added later):

| Tool | Does |
|---|---|
| `search_catalog(filters, interpretations, sort, limit)` | Live Sample search |
| `load_system(name)` | Live System load into the System view |
| `set_scene_view(focus, time_scale, labels, color_by)` | Scene `ui_commands` |
| `compare(planet_ids \| sample, x, y)` | Table + Plotly scatter |
| `export_report(title, include)` | HTML Report covering the chosen part of the Project |
| `web_search(query)` | Web sources for questions the archive can't answer |

- `web_search`: a normal custom tool whose handler calls xAI's `web_search` tool via `POST /v1/responses` with `grok-4.20-0309-non-reasoning` (measured ~6 s, 16–22 source URLs from `web_search_call.action.sources` and message annotations). Gemini's built-in `google_search` was rejected after the smoke test: mixing it with function declarations returns HTTP 500, and alone it takes 34–58 s on Gemma 4 26b. Rules: search only when the archive can't answer; at most one search per turn; claims cited aloud; no domain restriction; web text treated as normal data.
- Web sources are a distinct evidence kind: badged, cited, never plotted, tabled or rendered in 3D.

**API**
- One endpoint for questions: `POST /turn {text | audio, project_id} → {transcript, reply_text, reply_audio, ui_commands[], data, project}`. The turn is recorded in that Project and saved before the response returns; a failed save is a warning, never a failed turn. `ui_commands` are validated server-side; no WebSockets, no frontend acknowledgement.
- The Project switcher alone uses `GET /projects` (newest first; unreadable files listed with their error), `POST /projects {name?}` and `GET /projects/{id}` (404 missing, 409 damaged). Files live in `projects/` (override with `EXOSCOPE_PROJECTS_DIR`).

**Report**
- Report layout (chosen from `prototype/report-look`, variant A "scientific paper"): summary, method, figures (chart beside the System view snapshot), data table with source papers, limitations, references and Web sources, tool-call log. Template-filled numbers and Gemma-written prose are visibly distinguished.
- Reports **copy** their data when written (settled with `prototype/project-model`): the HTML is rendered once at write time and never changes, even if the Project's items are later redone or deleted; the Project JSON keeps the Report's metadata (title, request, included item IDs).
- A Project can hold many Reports. Each covers a chosen part of the Project: Gemma picks the comparisons, Samples, Systems and Web sources from the request ("a report on the TRAPPIST-1 radius comparison") and says what it included. Each Report has a title, is listed in the Project explorer, opens in a new tab, and is never edited after it is written; to change one, write a new one.
- One self-contained HTML file: title, numbered tool-call log for the included items, interactive Plotly chart (embedded JSON), System view snapshot (canvas capture), data table with units/uncertainties/source papers, Live-vs-Snapshot provenance, Interpretations, "Literature & web sources", Limitations.
- The template fills every number and table from saved data. Gemma writes only the short summary and the limitations prose. No readiness checklist.

## Build order

1. **Smoke test (done 2026-10-25, results on issue #1):** Gemma 4 26b tool call ✓ (~3 s); Grok TTS ✓ (0.8 s) and STT ✓ (0.5 s); xAI `web_search` ✓ (~6 s); Gemini `google_search` ✗ (see `web_search` above).
2. System view for TRAPPIST-1 with real orbits and the badge.
3. `/turn` + agent loop + scene tools.
4. Compare chart with linked selection.
5. Live Sample search with Interpretation chips; cross-System click.
6. `web_search`.
7. Projects (save, switch, new) and Report export.
8. Record the demo video (script the six beats; retake slow or failed turns).

## Non-goals

- Star map / population view in 3D; more than one System in the System view.
- Evidence-inspection panel (tooltips only).
- Student file uploads (PDFs, papers, worksheets).
- Checking the model's prose or numbers against evidence (beyond tools returning honest errors).
- What-if scenarios, Lightkurve, REBOUND, transit fitting, MCP server.
- CSV / manifest bundles, PDF export.
- ADK, LangGraph, WebSockets, deployment.
- Model-written SQL or code; habitability or discovery claims stated as fact.
- Photorealistic surfaces; animation presented as current true positions.
