# Web sources in a Project

`web_search(query)` is a normal custom tool in the Gemma 26B loop. Its handler makes a separate xAI Responses request using `grok-4.20-0309-non-reasoning` and the built-in `web_search` tool, following the current product intent. Gemini Google Search remains diagnostic history, not the production provider.

## Registry integration

`agent/tools/web_search.py` defines the strict `WebArguments` model and `WEB_SEARCH` Tool, registered once beside `LOAD_SYSTEM` in `agent/tools/registry.py`. Its handler returns `ToolOutput(payload, detail)` on success and raises `ToolError` for policy refusals or unavailable evidence. The generic `agent/loop.py` is unchanged from main's registry prefactor.

`agent/runner.py` is the turn entry point used by `/turn`: it scopes the original question's Web policy with a `ContextVar`, resets it after every turn, and composes original cited text with canonical archive findings. Failed validation still consumes the Web attempt through the generic loop's step history. Unrecovered Web errors retain the common tool error and skip speech synthesis; archive evidence and successful commands remain available. This supersedes the historical spoken fallback observation below.

`websearch/service.py` keeps the provider boundary: `SearchProvider.search(query)` returns the shared `WebSearchResult`; `get_provider()` selects the configured provider at call time. xAI is the only implementation and remains the default. No Tavily dependency, key selection, or request path is added.

## Request and evidence boundaries

- Each turn can attempt Web search once, including unsuccessful attempts, within the five-tool-call budget. The handler makes one HTTP request with no automatic retry or redirect, and a 15-second overall deadline. A request can contain multiple internal search actions by the provider.
- Queries are trimmed and bounded to 1–1000 characters. `XAI_API_KEY` is read server-side at call time. Google credentials and the Gemma model setting are not used by the search adapter.
- The request explicitly includes `web_search_call.action.sources`. Sources come only from completed search-call metadata and assistant message URL-citation annotations, retaining exact safe HTTP(S) URLs, meaningful returned titles or hostname fallbacks, and UTC retrieval times.
- Annotation offsets identify citation Markdown using character indices with an exclusive end. The adapter validates that the exact indexed marker points to the annotation URL; it does not apply Gemini byte-offset rules or repair bad offsets by searching prose.
- `WebSupport` associates a validated citation marker with nearby unchanged original paragraph text. This application convention records citation placement; it is not provider-guaranteed semantic verification or fact checking. Adjacent citations can share nearby text, and associations never cross output blocks.
- Retrieved source lists can include URLs that were not cited beside a claim. Those IDs remain distinct from the IDs attached to support text and must not be presented as backing every claim.
- Missing credentials, timeout, rejected/incomplete responses, malformed JSON, and absent usable citations return an honest unavailable result without invented or previous-turn evidence. Provider exception bodies and credentials are not exposed.

The backend blocks Web search for archive-only measurements and System metadata, including radius and planet-count questions. Missing archive values remain missing. External causal questions and mixed questions can still request Web evidence. Mixed findings combine requested measured canonical quantities and archive provenance with cited external text; attribution appears early in the short spoken finding.

Only the canonical catalog supplies System values and commands. Web evidence travels separately in `data.web_search` and never supplies chart, table, or System-view numbers. The original search answer and citation associations stay attached to their conversation turn, while the Project retains previously gathered sources. A failed current search has no citations of its own.

## Live provider observation — 2026-10-25

A request asking what NASA sources say about liquid water on TRAPPIST-1 e passed the actual xAI adapter: 33 retrieved sources, six annotation-linked text segments, and 13.11 seconds, with no error. The initial eight-second request timed out honestly; the overall deadline was then changed to 15 seconds and verified again. These were separate explicit diagnostic runs, not automatic retries within a turn. Search latency is not claimed to be uniformly six seconds.

Safe local evidence is recorded in ignored artifacts: `xai-search-live-summary.json`, `xai-search-live-result.json`, and `xai-search-response.json`. Offline tests use constructed provider fixtures, not that live response.

A later live full `/turn` check retained all seven canonical planets and generated a spoken fallback, but its one Web search attempt reached the 15-second deadline; the complete turn took 53.06 seconds. No citations were invented. That run verifies the failure path, not a successful live end-to-end cited answer. The direct live adapter success and mocked full-pipeline success are recorded separately; provider latency remains variable.

## Historical Gemini investigation

The original 31B function, mixed-tool, and standalone-search probes returned HTTP 500/504. The 26B model subsequently passed function/result checks and a live seven-planet System load. One mixed Google-search run passed citation verification, but later mixed runs and standalone searches did not establish reliable grounding. The original separate Google-search adapter also returned unavailable. Those results are historical diagnostics, not production xAI failures or search success claims.

See [service smoke evidence](service-smoke.md), [voice integration](voice.md), and the current [product intent](intent.md).

## Integrated verification

Full `./scripts/verify` passed after rebasing onto the agent registry prefactor (`8603afb`): 322 backend tests, 42 frontend tests, generated API, formatting/lint/strict types, production build, five backend-validated browser fixtures, and combined voice/layout/Web-source browser smoke. The screenshot and console were inspected with zero console errors. Provider and model calls in browser verification are explicitly mocked.

Focused backend coverage also exercises the production `/turn` entry point, concurrent turn policy isolation, policy cleanup, and substitution at the provider boundary.

The browser flow checks per-turn source associations, numeric citations, unique anchors, retrieved-only labels, retained history and accumulated Project sources, no stale evidence on a failed current turn, spoken attribution, archive-only questions, and unchanged archive/System values. Source and transcript UI use the preserved vendored shadcn controls; the canonical catalog implementation and Snapshots are unchanged.
