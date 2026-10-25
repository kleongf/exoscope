# ExoScope — Intent

The document every agent works from. Vocabulary is defined in [GLOSSARY.md](../GLOSSARY.md); use those terms exactly. The original long-form brief is [project-brief.md](project-brief.md) — background only; where it disagrees with this file, this file wins.

## What we are building

A voice-operated exoplanet research workbench. A student speaks (or types) a question; Gemma calls typed tools against **live** NASA Exoplanet Archive data; the **System view** (3D) and a linked chart update; at the end the student exports a **Report** of the **Investigation** with its evidence.

Hackathon: **about 4 hours, 2 people.** Tracks: Space/Cursor/Grok, Gemma, Open-source. The demo matters more than completeness.

## Who it is for

Students running an evidence-based Investigation, with educators as the secondary user. Not researchers.

## What "good" looks like — the demo (build backwards from this)

1. **"Open TRAPPIST-1."** — System loads live into the System view.
2. **"Speed up time / focus on planet e."** — scene changes via tool-issued `ui_commands`.
3. **"Compare radius and irradiation."** — one Plotly scatter + table; clicking a point focuses that planet.
4. **"Does any of these have liquid water?"** — the web-search beat: Gemma answers from archive fields, uses `web_search` because the archive cannot answer, and cites Web sources aloud. Rehearse twice; judged by citations being present.
5. **"Find small planets with periods under 10 days."** — live Sample search; Gemma states its Interpretation of "small" and it shows as an editable chip. Clicking a Sample point in another System loads that System live (~1.1 s) and focuses the planet.
6. **"Make a report."** — one self-contained HTML Report.

Backup demo System if TRAPPIST-1 misbehaves: TOI-700 (not Kepler-186 — its eccentricities are placeholders).

## Settled decisions

**Product**
- Name: ExoScope.
- The System view shows exactly one System. Samples live only in the table/chart.
- Orbits: Keplerian ellipses at true relative scale, phase from transit epochs; default camera looks down on the orbital plane. Persistent badge: "View rotated: system is edge-on from Earth · Positions extrapolated from transit epochs · Planet sizes ×N · Not an N-body simulation."
- Push-to-talk voice (Grok STT/TTS) plus an always-visible text box; transcript always shown.
- Runs on localhost for the demo.

**Data**
- Every query runs live against TAP (`pscomppars` only) with a ~5 s timeout; on failure fall back to a Snapshot. Each result is labelled "Live · fetched HH:MM" or "Cached · Snapshot YYYY-MM-DD". Measured latency: ~1.1–1.4 s per query.
- `pscomppars` mixes publications; the property tooltip shows each value's source paper, and the Report states values may not be mutually consistent.
- Canonical IDs are archive `pl_name` / `hostname`. Lookup is case/spacing-insensitive; ambiguous or unknown names return an explicit tool error — the agent never guesses.
- Filters use an allowlist of ~15 fields (radius, mass, period, semi-major axis, eccentricity, insolation, equilibrium temp, discovery year, discovery method, stellar Teff/radius/mass, distance) with operators `< <= > >= = between is_null`. The backend builds ADQL; the model never writes SQL or code.
- Known data quirks: `st_lum` is log10(L/Lsun); `pl_orblper` can fall outside [0, 360) — normalise mod 360; 28 rows lack `sy_dist`.

**Agent**
- Plain `google-genai` function-calling loop with Gemma 4. No ADK. Max 5 tool calls per turn.
- Vague words become Interpretations: Gemma picks one, says it aloud, it is passed as `interpretations` on `search_catalog`, shown as a chip, recorded in the Report. Loaded words ("Earth-like", "habitable") always carry a caveat.
- Tools (more may be added later):

| Tool | Does |
|---|---|
| `search_catalog(filters, interpretations, sort, limit)` | Live Sample search |
| `load_system(name)` | Live System load into the System view |
| `set_scene_view(focus, time_scale, labels, color_by)` | Scene `ui_commands` |
| `compare(planet_ids \| sample, x, y)` | Table + Plotly scatter |
| `export_report()` | HTML Report |
| `web_search(query)` | Web sources for questions the archive can't answer |

- `web_search`: a normal custom tool whose handler makes a separate Gemma call with only Gemini's built-in `google_search` enabled, returning grounded text plus grounding chunks (title, uri). If the smoke test shows Gemma can mix `google_search` with function declarations in one request, drop the separate call. Rules: search only when the archive can't answer; at most one search per turn; claims cited aloud; no domain restriction; web text treated as normal data.
- Web sources are a distinct evidence kind: badged, cited, never plotted, tabled or rendered in 3D.

**API**
- One endpoint: `POST /turn {text | audio} → {transcript, reply_text, reply_audio, ui_commands[], data}`. `ui_commands` are validated server-side; no WebSockets, no frontend acknowledgement.

**Report**
- One self-contained HTML file: research question, numbered tool-call log, interactive Plotly chart (embedded JSON), System view snapshot (canvas capture), data table with units/uncertainties/source papers, Live-vs-Snapshot provenance, Interpretations, "Literature & web sources", Limitations.
- The template fills every number and table from saved data. Gemma writes only the short summary and the limitations prose.

## Build order

1. **Smoke test first (partner):** one Gemma 4 tool call, Gemma `google_search` mixed with function declarations in one request, one Grok STT→TTS round-trip. Nothing else is trusted until this passes.
2. System view for TRAPPIST-1 with real orbits and the badge.
3. `/turn` + agent loop + scene tools.
4. Compare chart with linked selection.
5. Live Sample search with Interpretation chips; cross-System click.
6. `web_search`.
7. Report export.
8. Rehearse the full demo twice.

## Non-goals

- Star map / population view in 3D; more than one System in the System view.
- Saved Samples beyond the current one; evidence-inspection panel (tooltips only).
- What-if scenarios, Lightkurve, REBOUND, transit fitting, MCP server.
- CSV / manifest bundles, PDF export.
- ADK, LangGraph, WebSockets, deployment.
- Model-written SQL or code; habitability or discovery claims stated as fact.
- Photorealistic surfaces; animation presented as current true positions.
