# Exoplanet Research Harness — Project Brief

Working names: **Parallax**, **OrbitLab**, or **ExoScope**. Name not selected; availability has not been checked.

Prepared October 25, 2026. This document separates agreed priorities from recommended implementation choices. Tool recommendations are documentation-reviewed, not integration-tested.

## Concept

A voice-operated exoplanet research workbench with an interactive 3D planetary system at its center. Users ask questions, select NASA archive data, compare planets, manipulate the visualization, and export an investigation with supporting evidence.

**Pitch:** “Investigate distant worlds by talking to them. Explore planetary systems in 3D, run real analyses, and turn your findings into a reproducible research brief.”

The harness connects the model to data, calculations, visualization state, and artifacts. Its value is completing an investigation, not simply narrating planet facts.

## Agreed priorities

- Education and research are the intended use cases; the initial user segment remains open.
- NASA’s Exoplanet Archive is the primary catalog.
- Prioritize a compelling, useful **3D visualization** and a research-oriented layout.
- Grok voice interaction is required; push-to-talk is acceptable.
- Use a reusable module with typed tools and an application API.
- Represent missing data and uncertainty honestly.
- Explore reports and visualizations as substantive outputs.
- There are three hackathon tracks, not four.

Recommended initial audience: students and educators conducting evidence-based investigations. Professional research workflows require additional validation beyond the hackathon demo.

## Why this is a harness

Engineering agent systems expose domain operations rather than only providing text answers. For example, [Flux](https://www.flux.ai/p/blog/flux-copilot-under-the-hood) gives its agent component search and calculation tools within design context. [Ansys PyFluent-MCP](https://github.com/ansys/pyfluent-mcp) exposes simulation workflows, diagnostics, comparisons, and report-related operations.

Our equivalent workflow is:

**Research question → dataset selection → analysis → linked 3D inspection → saved report.**

The reusable contribution is a set of exoplanet tools, evidence records, scene commands, and investigation state that another application or agent can use.

NASA’s [archive homepage](https://exoplanetarchive.ipac.caltech.edu/) already advertises AstroFetch for natural-language archive questions. Differentiate through the linked 3D workspace, reproducible analyses, and exported artifacts rather than claiming novelty for conversational queries alone.

## Recommended MVP

| Capability | User request | Concrete result |
|---|---|---|
| Load a system | “Open TRAPPIST-1.” | Selectable planets, orbital animation, properties and references |
| Control the scene | “Focus on this planet and slow time down.” | Camera and timeline update through validated commands |
| Compare planets | “Compare radius and stellar irradiation.” | Table and chart linked to the selected planets |
| Inspect evidence | “Where did that number come from?” | Source field, units, uncertainties, reference, retrieval timestamp |
| Build a sample | “Find small planets with periods under ten days.” | Explicit filters, saved results, missing-data and exclusion summary |
| Export an investigation | “Create a brief of what we found.” | Markdown/HTML report, chart image, scene snapshot, CSV, analysis manifest |

Treat “small” as an ambiguous request: propose and visibly state a radius threshold or ask for clarification. Do not silently translate it into a scientific category.

Minimum complete demo: one carefully checked system, one comparison workflow, voice-driven scene control, and report export. Broaden catalog coverage after this works.

### Extensions, in priority order

1. **Narrow what-if experiment:** Change orbital distance while holding stellar properties fixed. Show an explicitly hypothetical scenario and deterministic recalculation with assumptions.
2. **Transit investigation:** Retrieve an appropriate Kepler/TESS light curve, plot it, and phase-fold it using a supplied period. This adds observational evidence beyond catalog summaries.
3. **Population exploration:** Plot a selected sample and calculate descriptive statistics with exclusions and selection-effect caveats.
4. **MCP exposure:** Let external agent clients call the same research tools.
5. **Advanced inference or dynamics:** Fit transit models or run gravitational simulations only when the team has time and expertise to validate them.

Do not include full galaxy navigation, photorealistic planetary surfaces, automatic discovery claims, or unrestricted model-written Python in the MVP.

## 3D workspace

The center of the app should be a large orbital-system view. Put search and saved samples on the left, selected-object properties on the right, and linked plots in a bottom drawer. Keep push-to-talk and a short transcript persistent.

Core interactions:

- Rotate, zoom, focus, and select planets.
- Play, pause, scrub, and change simulation speed.
- Toggle orbital labels and property-based coloring with a legend.
- Link selection between scene, chart, and table using canonical object IDs.
- Display exaggerated planet sizes explicitly; offer a physical-scale mode if useful.
- Keep observational records and hypothetical scenarios separate.

Scientific constraints:

- Incomplete orbital geometry means the scene may be schematic. Label assumed orbital planes, phase, or circularity instead of inventing measured values.
- Do not describe animation as a precise reconstruction of current positions without adequate orbital elements and epochs.
- A missing semi-major axis must be shown as missing, derived with a recorded method where justified, or replaced by a clearly schematic layout.
- Planet textures are illustrative, not observed surface maps.
- Keplerian animation is not an N-body stability calculation.
- Equilibrium temperature is not a measured surface temperature; radius and irradiation do not establish oceans or habitability.

## Recommended open-source foundations

### Agent runtime: Google ADK

[Google ADK Python](https://github.com/google/adk-python) is an open-source agent framework under Apache-2.0. Its [Gemma integration documentation](https://github.com/google/adk-docs/blob/main/docs/agents/models/google-gemma.md) includes Gemma 4 through the Gemini API, tools, and structured output.

**Recommendation:** Start with one ADK agent and ordinary Python tool functions. Keep astronomy logic separate from ADK so the same functions can later serve HTTP or MCP clients.

Before committing, run a small integration check with the actual API key: a tool call, validated execution, returned tool result, and grounded final answer. Documentation support is not proof of account access or successful integration.

[LangGraph](https://github.com/langchain-ai/langgraph) is an alternative if explicit persistent workflow graphs become central. Choose one runtime; using both would add unnecessary complexity. A small direct SDK loop is also reasonable if ADK integration becomes the bottleneck.

### Astronomy data: Astroquery

[Astroquery’s NASA Exoplanet Archive module](https://astroquery.readthedocs.io/en/latest/ipac/nexsci/nasa_exoplanet_archive.html) provides an existing Python client for archive access. Use it behind typed query tools rather than inventing an archive client from scratch.

NASA’s [TAP service](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html) is the underlying access mechanism. A direct HTTP TAP adapter is a smaller alternative if only a few fixed queries are needed. Do not maintain both paths initially.

### Units and scientific calculations: Astropy

[Astropy](https://www.astropy.org/) and its [units system](https://docs.astropy.org/en/stable/units/index.html) provide astronomy primitives and explicit quantities. Use them for unit conversions and deterministic derived comparisons. The language model selects operations and explains results; it does not supply the arithmetic.

### 3D interface: React Three Fiber

[React Three Fiber](https://github.com/pmndrs/react-three-fiber) is an MIT-licensed React renderer for Three.js. It fits a custom research interface whose scene responds to shared application state.

**Recommendation:** Use it for the primary view if the team knows React. The team still implements orbital mapping, scientific labels, selection, and timeline behavior.

[Spacekit](https://github.com/typpo/spacekit) is an existing JavaScript library specifically for 3D space visualization. Evaluate one small orbital example if accelerating the astronomy scene is more valuable than React integration. Treat it as an alternative rendering foundation, not a second scene engine layered on top of React Three Fiber. Check current examples, dependencies, and redistribution terms before adoption.

### Charts: Plotly.js

[Plotly.js](https://github.com/plotly/plotly.js) supplies interactive scientific charts. Use stable planet IDs in chart events to link points to the 3D scene. Start with scatterplots and comparisons; export the same plotted data into the report bundle.

### Reuse outside the app: official MCP Python SDK

The [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) can expose the same domain functions to compatible agent clients. MCP is a tool interface, not an agent runtime or scientific validation layer. Add it after the app workflow works; an MCP endpoint alone is not the product.

### Optional research engines

| Tool | Real capability | When to add it |
|---|---|---|
| [Lightkurve](https://lightkurve.github.io/lightkurve/) | Analyze astronomical brightness time series, especially Kepler/TESS | Best next addition for inspecting observational data; select a supported target and record preprocessing |
| [REBOUND](https://rebound.hanno-rein.de/) | Gravitational N-body simulations | Only if orbital interactions are the feature; needs defensible initial conditions and simulation settings |
| [exoplanet](https://docs.exoplanet.codes/en/stable/) | Probabilistic astronomical time-series modeling using PyMC | Advanced parameter inference, not catalog lookup or 3D rendering; likely outside MVP scope |

Do not install these solely to make the architecture sound more scientific. Each should enable a visible, tested user workflow.

### Proposed stack

- Frontend: React + TypeScript, React Three Fiber, Plotly.js.
- Backend: Python API with a single ADK agent, typed tool arguments, Astroquery, and Astropy.
- Persistence: a simple local database or files for cached records and investigation manifests; choose based on deployment needs.
- Reports: template-generated Markdown/HTML plus exported figures and CSV; PDF is optional.
- Model: Gemma 4 through the Gemini API.
- Voice: Grok speech input/output around the same agent session.
- Deployment: DigitalOcean for the application/backend; model inference initially stays on the required hosted API.

These are recommendations, not finalized team decisions. The open-source components are distinct from hosted services: NASA supplies data; Gemini and Grok APIs are service integrations, not open-source dependencies. Preserve notices and check the licenses of selected versions before distribution.

## Architecture and tool contracts

```text
Browser: 3D scene + linked charts + push-to-talk
                    |
       Backend session / investigation state
                    |
            Gemma agent via ADK
                    |
       Validated, bounded domain tool calls
          /             |              \
    NASA adapter   Calculations    Scene/chart commands
          \             |              /
          Evidence records + analysis artifacts
                    |
        UI updates + report + spoken response
```

Suggested initial tools:

| Tool | Contract |
|---|---|
| `search_catalog(filters, sort, limit)` | Allowlisted fields and operators; bounded result count; save filters and exclusions |
| `load_system(host_name)` | Resolve the system and return canonical IDs, parameters, provenance, and missing fields |
| `set_scene_view(selection, camera, time_scale)` | Validated scene commands, acknowledged by the frontend |
| `compare_properties(ids, properties)` | Aligned values with units, uncertainty, and missing-data status |
| `create_plot(sample_id, plot_spec)` | Allowlisted plot types/axes; return a saved artifact linked to evidence |
| `export_report(investigation_id)` | Build from completed analyses and current artifacts |

Add `run_scenario` only after defining exactly which physical calculation is supported. Keep tools callable without a model for tests and external reuse.

Each evidence record should include object ID, archive table and field, value, unit, available uncertainty/limit flags, reference, retrieval time, and snapshot ID. Derived records additionally include input evidence IDs, formula/method, and assumptions.

Investigation state should track selected objects, saved samples, tool runs, charts, scene settings, and outputs. Numeric claims can be checked against evidence; this does not by itself validate every scientific conclusion in generated prose.

Do not execute model-generated SQL or code. Convert validated filters into parameterized or safely constructed queries. Treat catalog text as data. Bound tool iterations and query sizes, and return explicit tool errors rather than fabricated success.

## NASA data choices

Use `pscomppars` for convenient broad catalog exploration. NASA notes that it combines parameters from different references and is not necessarily physically self-consistent. Use `ps` publication-specific records when an analysis needs a consistent published parameter set; do not assume this provides a unified solution for an entire multi-planet system.

Preserve field references, uncertainty, limits, and provenance of derived values. Missing is not zero. Some mass values represent minimum mass rather than a true measured mass and must not be silently treated as interchangeable.

Sources: [table definitions](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html), [composite calculation notes](https://exoplanetarchive.ipac.caltech.edu/docs/composite_calc.html).

## Voice integration

Use push-to-talk, send the transcript into the same session used by the visual interface, and speak the resulting answer after its tool actions complete. Gemma owns research reasoning; the speech layer should not independently improvise scientific claims.

xAI documents both [speech-to-text](https://docs.x.ai/developers/model-capabilities/audio/speech-to-text) and [text-to-speech](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech). Verify the chosen endpoints with the actual account and confirm they satisfy the sponsor’s interpretation of the Voice API requirement. If the sponsor requires a particular voice-agent endpoint, adapt the integration accordingly.

Show the recognized transcript so planet-name errors can be corrected. Keep API credentials server-side. Long reports stay on screen; voice delivers a short finding and the next useful action.

## Demo: investigate a system in two to three minutes

1. **“Open TRAPPIST-1.”** Load a prechecked archive snapshot into a live 3D scene. Explain schematic assumptions where needed.
2. **“Show orbital periods and speed up time.”** Update labels and animation through actual tool-driven scene commands.
3. **“Compare planet radius and stellar irradiation.”** Create a linked chart and table using available records. Selecting a point focuses the corresponding planet.
4. **“Does this tell us which planet has liquid water?”** Explain what the measurements support and which atmospheric information is absent.
5. **“Create a research brief with this comparison and its limitations.”** Export the question, data selection, chart, scene snapshot, sources, and analysis manifest.

Confirm the chosen system has the necessary fields before finalizing the script. This demo proves workspace control, real data analysis, uncertainty handling, and artifact generation. It does not claim new planetary discovery.

## Build sequence and acceptance criteria

1. **Integration check:** Verify Gemma tool execution, Grok input/output, and an archive query using actual credentials. Confirm tool failures are surfaced.
2. **3D foundation:** Load one system with selection, orbit animation, labels, and explicit scale/geometry assumptions. Verify periods and units against the chosen snapshot.
3. **Analysis:** Produce one comparison with linked selection. Verify chart/table values and missing-data handling agree.
4. **Agent control:** Complete a spoken request through validated tools and an acknowledged UI update. Verify the agent does not claim actions that failed.
5. **Report:** Export actual analysis artifacts and their provenance. Verify every figure and numeric summary maps to the saved investigation.
6. **Demo rehearsal:** Run the complete workflow, including a question unsupported by the available data.

Focused checks should cover wrong units, missing values, unknown object names, mass-limit interpretation where used, unsupported claims, and reproducible report values. Cache data with timestamps for repeatability; do not describe a cached response as a live archive fetch.

## Track alignment

- **Space / Cursor / Grok:** Build with Cursor, retain concrete examples of its contribution, and integrate Grok voice into the working app. Grok Bot planning is an optional bonus from the supplied rules.
- **Gemma:** Gemma performs the actual tool selection and scientific explanation. A later feature could let it inspect an exported chart image for a substantive multimodal workflow.
- **Open-source / open-weight AI:** Use Gemma as a meaningful agent component and publish the reusable harness if the team chooses. DigitalOcean hosts the application.

Multi-track submission eligibility remains subject to organizer rules.

## Naming shortlist

| Name | Positioning |
|---|---|
| Parallax | Polished scientific identity; “A new perspective on distant worlds.” |
| OrbitLab | Clear research and experimentation emphasis |
| ExoScope | Directly connects exoplanets and investigation |
| ExoLens | Visual and evidence-oriented |
| Asteria | Broader exploration identity |
| Worldline | Memorable, broader than astronomy |
| Orbital Atlas | Educational exploration |
| ExoWorkbench | Explicit developer/research utility |
| Ephemeris | Technical astronomy identity |
| Sidereal | Scientific and atmospheric |
| ExoTrail | Emphasizes provenance and discovery |

## Decisions still needed

- Final name.
- Initial user: student, educator, or researcher selecting targets.
- Team size, time remaining, strongest skills, and 3D implementation owner.
- API access and credits.
- Confirm orbital-system visualization as the initial 3D focus.
- Report purpose: class investigation, teaching resource, or research shortlist.
- Whether Lightkurve or a narrow what-if calculation fits after the core workflow.

No implementation has been started by this brief.
