# OpenAI Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Gemma (tool agent) and Grok (speech-to-text, text-to-speech, web search) with OpenAI for the demo, keeping every honesty rule and the `/turn` contract unchanged.

**Architecture:** One small `exoscope/openai_api/` feature owns the key, the hardened `httpx` client, model names and safe error messages. The agent loop keeps its shape (`run_loop(text, current_system, generate)`, max 5 tool calls, honest tool errors) but speaks the Responses API instead of `google-genai`. Voice and web search keep their public functions (`transcribe`, `synthesize`, `search_web`) and swap the endpoint behind them. `/turn`, `TurnResponse`, the frontend and the generated API types do not change.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, `httpx` (no new SDK; same hardening as today: no retries by default, no redirects, `trust_env=False`), OpenAI Responses API, `/v1/audio/transcriptions`, `/v1/audio/speech`.

**Spec:** The decisions below (Kevin, 2026-10-25) plus `docs/intent.md`. Where they disagree, these decisions win and Task 6 updates `intent.md`.

## Decisions

| Concern | Before | After |
|---|---|---|
| Tool agent | Gemma 4 `gemma-4-26b-a4b-it`, `google-genai` | `gpt-6-luna` via `POST /v1/responses`, function tools |
| Speech-to-text | Grok `grok-voice-transcribe-2.0` | `gpt-transcribe` via `POST /v1/audio/transcriptions` |
| Text-to-speech | Grok `/v1/tts`, voice `eve` | `gpt-4o-mini-tts` via `POST /v1/audio/speech`, WAV |
| Web search | Grok `grok-4.20-0309-non-reasoning` `/v1/responses` + `web_search` | OpenAI `/v1/responses` + `{"type": "web_search"}` |
| Keys | `GEMINI_API_KEY`, `XAI_API_KEY` | `OPENAI_API_KEY` only |

- Replace, don't switch: Gemma and Grok code paths are removed (git history is the fallback). The Gemma and Grok hackathon tracks are given up; Task 6 records this in `intent.md`.
- `web_search` stays a **custom tool** that calls OpenAI's built-in search in a separate request. This keeps `web_policy.py` (archive first, one search per turn, cited synthesis) and `grounding.py` intact. Not chosen: letting the agent call the built-in tool directly, which would bypass the policy.
- `gpt-4o-mini-tts` is deprecated and shuts down **2027-01-06** (OpenAI docs); fine for the demo. The successor is the Realtime API (`gpt-live-1`), out of scope.
- OpenAI's web-search docs list `gpt-6-astra`, `gpt-5.5`, `gpt-4.1`, `gpt-4.1-mini` as supported and do not mention `gpt-6-luna`. Default the search model to `gpt-4.1-mini`; Task 7 tries `gpt-6-luna` live and switches the default if it works and is faster.

## Global Constraints

- The model never writes SQL or code; tools stay allowlisted (`CLAUDE.md`).
- Secrets live in `.env`, server-side only. The app must start without `OPENAI_API_KEY`; features then fail with an honest message (`"… is unavailable: OPENAI_API_KEY is not configured."`).
- Never forward provider bodies, URLs, exception text or headers to the student or logs (existing rule in `voice/service.py`, `websearch/service.py`, `loop.py`).
- Max 5 tool calls per turn; at most one web search per turn.
- Files stay under 300 lines. One directory per feature.
- `/turn` request and response shapes do not change, so `pnpm gen:api` must produce no diff.
- Model names are read from env at call time with these defaults: `OPENAI_AGENT_MODEL=gpt-6-luna`, `OPENAI_SEARCH_MODEL=gpt-4.1-mini`. STT and TTS model names are constants.

## Review Focus

1. **Reasoning items on later steps.** With `store: false`, a reasoning model rejects a follow-up request that omits its earlier reasoning items. Expect a two-step tool turn to work. Pinned in Task 2 (`test_reasoning_items_are_sent_back_verbatim`).
2. **Malformed tool arguments.** The model returns `arguments` that aren't valid JSON. Expect `"Invalid load_system arguments."`, a failed step and no crash. Pinned in Task 2.
3. **Quota and rate limits.** OpenAI returns 429, either for the rate limit or for `insufficient_quota`. Expect a specific message naming the cause, with no provider body. Pinned in Task 1 (`failure_message`).
4. **Search model rejects the `web_search` tool (400).** Expect `"Web search is unavailable; …"`, the turn still answers from the archive, and no 500. Pinned in Task 4.
5. **Transcript is empty or only noise.** Expect `"No speech was recognized. Please try typing instead."`, the same as today. Pinned in Task 5.

---

### Task 1: `openai_api` feature — key, client, models, failures

**Files:**
- Create: `backend/exoscope/openai_api/__init__.py`, `backend/exoscope/openai_api/client.py`, `backend/exoscope/openai_api/models.py`
- Test: `backend/tests/test_openai_api.py`

**Interfaces:**
- Produces:
  - `openai_key() -> str | None`: the stripped `OPENAI_API_KEY`, or `None`.
  - `openai_client(timeout: httpx.Timeout) -> ContextManager[httpx.Client]`: `base_url="https://api.openai.com"`, `Authorization: Bearer <key>`, `follow_redirects=False`, `trust_env=False`, `retries=0`. Raises `OpenAIUnavailable` (subclass of `Exception`) when there's no key.
  - `failure_message(service: str, exc: Exception) -> str`: a safe message.
  - `agent_model() -> str`, `search_model() -> str`; `STT_MODEL = "gpt-transcribe"`, `TTS_MODEL = "gpt-4o-mini-tts"`, `TTS_VOICE = "coral"`.

- [ ] **Step 1: Write failing tests**

```python
def test_no_key_is_unavailable(monkeypatch): # delenv OPENAI_API_KEY
    with pytest.raises(OpenAIUnavailable, match="OPENAI_API_KEY is not configured"):
        with openai_client(httpx.Timeout(5)): ...
def test_models_default_and_env(monkeypatch):
    assert agent_model() == "gpt-6-luna" and search_model() == "gpt-4.1-mini"
    monkeypatch.setenv("OPENAI_AGENT_MODEL", "gpt-6.1-sol"); assert agent_model() == "gpt-6.1-sol"
@pytest.mark.parametrize(("status", "body", "expected"), [
    (429, {"error": {"code": "insufficient_quota"}}, "The OpenAI account has no remaining quota"),
    (429, {"error": {"code": "rate_limit_exceeded"}}, "rate limit was reached"),
    (503, {}, "servers returned an error (503)"),
    (401, {}, "rejected the API key"),
])
def test_failure_message_names_the_cause_without_the_body(status, body, expected):
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(status, json={**body, "secret": "sk-leak"}, request=request)
    msg = failure_message("The agent", httpx.HTTPStatusError("x", request=request, response=response))
    assert expected in msg and "sk-leak" not in msg and "api.openai.com" not in msg
def test_timeout_message(): assert "took too long" in failure_message("The agent", httpx.ReadTimeout("x"))
```

- [ ] **Step 2: Run** `cd backend && uv run pytest tests/test_openai_api.py -q`. Expected: FAIL, `ModuleNotFoundError: exoscope.openai_api`.
- [ ] **Step 3: Implement** the three modules. `failure_message` reads only `response.status_code` and `error.code` from the JSON body (never the message text). Empty-key behaviour matches the existing voice adapter.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** with message `openai_api: key, hardened client, model names, safe failures`.

### Task 2: Agent loop on the Responses API

**Files:**
- Create: `backend/exoscope/agent/responses.py` (parse output items), `backend/tests/model_fakes.py` (shared fakes)
- Modify: `backend/exoscope/agent/loop.py` (whole file), `backend/exoscope/agent/tools/registry.py` (`declaration()` → `tool_definitions()`), `backend/exoscope/agent/runner.py` (type alias only)
- Delete: `backend/exoscope/agent/model_config.py`, `backend/tests/test_gemma_model.py`
- Migrate to `model_fakes`: `tests/test_agent.py`, `test_agent_mixed.py`, `test_agent_web.py`, `test_compare_tool.py`, `test_report_tools.py`, `test_search_tool.py`, `test_set_scene_view.py`, `test_turn_web.py`, `test_web_registry.py`, `test_web_synthesis.py`

**Interfaces:**
- Consumes: Task 1 (`openai_client`, `openai_key`, `agent_model`, `failure_message`).
- Produces:
  - `Generate = Callable[[list[dict[str, object]]], dict[str, object]]`: takes the accumulated `input` items and returns the raw Responses JSON.
  - `run_loop(text, current_system, generate) -> AgentResult` and `run_agent(text, current_system=None) -> AgentResult`, with unchanged signatures.
  - `tool_definitions() -> list[dict[str, object]]`: `{"type": "function", "name", "description", "parameters": model_json_schema(), "strict": False}`. Pydantic schemas with optional fields are not strict-compatible.
  - `tests/model_fakes.py`: `answer(text: str) -> dict`, `call(name: str = "load_system", call_id: str = "call-1", **arguments) -> dict` (one `function_call` output item), `calls(*items) -> dict`, `reasoning(id: str) -> dict`.

Request body for every step: `model`, `instructions=INSTRUCTIONS` (the current text, minus Gemma wording), `input`, `tools`, `max_output_tokens: 1024`, `store: false`, `include: ["reasoning.encrypted_content"]`. Timeout 30 s; retry 5xx up to 3 attempts, never 429. The current-System context and question go in as one `{"role": "user", "content": ...}` item. After each response, append **every** output item verbatim, then one `{"type": "function_call_output", "call_id", "output": json.dumps(payload)}` per call.

- [ ] **Step 1: Write `tests/model_fakes.py` and port `test_agent.py`.** Replace its local `answer`/`call` helpers with imports from `model_fakes`; the assertions stay the same. Add:

```python
def test_reasoning_items_are_sent_back_verbatim(monkeypatch):
    seen = []
    replies = iter([calls(reasoning("rs_1"), call("load_system", name="TRAPPIST-1")), answer("Loaded.")])
    def generate(items): seen.append(list(items)); return next(replies)
    loop.run_loop("Open TRAPPIST-1", None, generate)
    assert {"type": "reasoning", "id": "rs_1", "encrypted_content": "enc"} in seen[1]
    assert any(i.get("type") == "function_call_output" and i["call_id"] == "call-1" for i in seen[1])
def test_unparseable_arguments_are_an_honest_tool_error():
    bad = {"output": [{"type": "function_call", "call_id": "c", "name": "load_system", "arguments": "{oops"}]}
    replies = iter([bad, answer("Sorry.")])
    result = loop.run_loop("Open it", None, lambda _: next(replies))
    assert result.steps[0].status == "failed" and result.steps[0].detail == "Invalid load_system arguments."
def test_missing_key_is_honest(monkeypatch):  # delenv OPENAI_API_KEY
    assert loop.run_agent("hi").error == "The agent is unavailable: OPENAI_API_KEY is not configured."
```

- [ ] **Step 2: Run** `uv run pytest tests/test_agent.py -q`. Expected: FAIL on imports and shape.
- [ ] **Step 3: Implement** `responses.py`:
  - `function_calls(response) -> list[FunctionCall]`: a Pydantic model with `call_id`, `name`, `arguments: str`.
  - `final_text(response) -> str`: joins `output_text` parts of `message` items.

  Then rewrite `loop.py` around these. `_execute` parses `arguments` with `json.loads`; on `JSONDecodeError` or `ValidationError`, the detail is `f"Invalid {name} arguments."`. Rename `gemma_failure` to use `failure_message("The agent", exc)`.
- [ ] **Step 4: Run** `uv run pytest tests/test_agent.py -q`. Expected: PASS.
- [ ] **Step 5: Port the other nine test files** listed above. Their local `answer`/`call` helpers become imports, and any `types.*` assertions become dict assertions. Run `uv run pytest -q`. Expected: all pass, and `grep -rn "google.genai" exoscope tests` prints nothing.
- [ ] **Step 6: Remove dependency** `google-genai` from `pyproject.toml`, then run `uv lock` and `uv run pyright`. Expected: 0 errors.
- [ ] **Step 7: Commit** with message `Agent loop on the OpenAI Responses API (replaces Gemma)`.

### Task 3: Provider-neutral prompts and briefs

**Files:**
- Modify: `backend/exoscope/agent/brief.py` (docstring: the compact view is for token cost and latency, not Gemma's 16k-per-minute limit), `agent/tools/web_search.py` (`MAX_SOURCES_FOR_GEMMA` → `MAX_SOURCES_FOR_MODEL`; the description says "do not copy the search provider's prose"), `agent/runner.py` and `agent/web_policy.py` (replace "Grok's" with "the search provider's"), `agent/tools/*.py` docstrings that say Gemma, `report/render.py`, `report/service.py` (anything a student sees that says "Gemma" now says "the assistant")
- Modify (frontend, user-visible copy only): `features/voice/TurnHistory.tsx`, `features/catalog/InterpretationChip.tsx`, `features/websearch/WebEvidence.tsx` (+ its test)
- Test: existing tests. Update string assertions that name Gemma or Grok.

- [ ] **Step 1:** Run `grep -rniE "gemma|grok" backend/exoscope frontend/src` and list each hit in the commit body.
- [ ] **Step 2:** Replace each hit. Report text that the student reads says "Written by the assistant · not number-checked".
- [ ] **Step 3: Run** `./scripts/verify --no-app`. Expected: OK, and the grep from Step 1 prints nothing.
- [ ] **Step 4: Commit** with message `Provider-neutral wording for the agent and search`.

### Task 4: Web search on OpenAI

**Files:**
- Modify: `backend/exoscope/websearch/service.py` (`XaiProvider` → `OpenAIProvider`, `ENDPOINT = "https://api.openai.com/v1/responses"`, `MODEL` → `search_model()`, key from `openai_key()`), `websearch/grounding.py` (only if the OpenAI fixture shows a field difference)
- Rename/modify tests: `tests/xai_fixtures.py` → `tests/search_fixtures.py`, `test_xai_service.py` → `test_search_service.py`, `test_xai_grounding.py` → `test_search_grounding.py`

**Interfaces:**
- Consumes: Task 1.
- Produces: unchanged `search_web(query: str) -> WebSearchResult`.

Request body: `{"model": search_model(), "input": query, "instructions": <unchanged one-search, 3-sentence, cite-inline text>, "tools": [{"type": "web_search", "search_context_size": "low"}], "include": ["web_search_call.action.sources"], "max_output_tokens": 200, "store": false}`.

- [ ] **Step 1: Write failing tests.**
  - The request goes to `api.openai.com/v1/responses` with `Bearer test-key` and the body above.
  - Missing key gives `"Web search is unavailable: OPENAI_API_KEY is not configured."`
  - A 400 response gives `status == "unavailable"`, `"Web search is unavailable; no usable Web evidence was returned."`, and the body is not echoed.
  - An OpenAI-shaped fixture (`message` with `output_text` + `url_citation` annotations `{type, url, title, start_index, end_index}`, plus `web_search_call.action.sources`) parses to the same `WebSearchResult` the xAI fixture produced.
- [ ] **Step 2: Run** `uv run pytest tests/test_search_service.py tests/test_search_grounding.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command plus `uv run pytest -q`. Expected: PASS.
- [ ] **Step 5: Commit** with message `Web search through OpenAI Responses web_search`.

### Task 5: Voice on OpenAI (speech-to-text and text-to-speech)

**Files:**
- Modify: `backend/exoscope/voice/service.py` (use `openai_client`; keep `REQUEST_TIMEOUT`, `MAX_SPEECH_CHARACTERS = 600`, `finalise_wav`, every `VoiceError` message)
- Modify tests: `tests/test_voice_service.py`, `tests/test_voice_support.py` (`install_transport` base URL)

**Interfaces:**
- Consumes: Task 1.
- Produces: unchanged `transcribe(audio: AudioInput) -> str` and `synthesize(text: str) -> ReplyAudio`.

Transcription: multipart `POST /v1/audio/transcriptions` with `model=gpt-transcribe`, `languages[]=en`, `keywords[]` = `["TRAPPIST-1", "TOI-700", "exoplanet", "insolation", "semi-major axis"]`, and the file part last. Response `{"text": ...}`.

Speech: `POST /v1/audio/speech` with `{"model": "gpt-4o-mini-tts", "voice": "coral", "input": finding, "response_format": "wav", "instructions": "Speak clearly and calmly, like a science teacher explaining to a student."}`. The response is WAV bytes.

- [ ] **Step 1: Write failing tests** (port the existing ones):
  - Transcription posts to `/v1/audio/transcriptions` with the model, keywords and file last.
  - `"   "` returns `"No speech was recognized. Please try typing instead."`
  - Speech posts the JSON above. A non-WAV `content-type` raises `"The voice service returned an unsupported audio format."`
  - A missing key raises `"Voice is unavailable: OPENAI_API_KEY is not configured."` with status 503.
- [ ] **Step 2: Run** `uv run pytest tests/test_voice_service.py tests/test_voice_support.py tests/test_voice_validation.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** with message `Voice through OpenAI: gpt-transcribe and gpt-4o-mini-tts`.

### Task 6: Service smoke, config and docs

**Files:**
- Replace: `backend/exoscope/service_smoke/gemma.py` → `service_smoke/agent.py` (one real tool call: "Open TRAPPIST-1" must call `load_system`), plus `service_smoke/voice.py` (round trip: TTS of `PHRASE`, then STT, must contain "TRAPPIST"), `service_smoke/__main__.py`
- Tests: `tests/test_smoke_gemma.py` → `tests/test_smoke_agent.py`, `test_smoke_voice.py`, `test_smoke_runner.py` (no key: each check reports `SKIP`/`FAIL` with a redacted message)
- Modify: `.env.example` (`OPENAI_API_KEY=`, commented `OPENAI_AGENT_MODEL=gpt-6-luna`, `OPENAI_SEARCH_MODEL=gpt-4.1-mini`; remove `GEMINI_API_KEY`, `GEMMA_MODEL`, `XAI_API_KEY`), `docs/intent.md` (Agent, `web_search`, voice and "Smoke test" sections; tracks note: Gemma/Grok replaced by OpenAI on 2026-10-25), `docs/voice.md`, `docs/web-search.md`, `docs/service-smoke.md`, `README.md`, `CLAUDE.md` (only if it names a provider)

- [ ] **Step 1:** Port the smoke tests. Run `uv run pytest tests/test_smoke_*.py -q`. Expected: FAIL until the modules exist.
- [ ] **Step 2:** Implement the smoke modules. Then run `uv run pytest -q` and `./scripts/verify --no-app`. Expected: OK.
- [ ] **Step 3:** Update the config and docs listed above. Run `grep -rniE "gemma|grok|xai|gemini" --exclude-dir=node_modules --exclude-dir=.venv backend frontend/src docs README.md .env.example`. Expected: only historical lines in `docs/project-brief.md` and the "replaced on 2026-10-25" note.
- [ ] **Step 4: Commit** with message `OpenAI service smoke, config and docs`.

### Task 7: Live verification (needs Kevin's `OPENAI_API_KEY`)

- [ ] **Step 1:** Kevin adds `OPENAI_API_KEY` to `.env`. Run `cd backend && uv run python -m exoscope.service_smoke`. Expected: agent PASS, voice PASS, web search PASS, with no key in the output.
- [ ] **Step 2:** Start the app (`./scripts/verify` must pass first). Type the six demo beats from `docs/intent.md` and record the elapsed time of each turn and the tool steps.
  - Expected: beats 1–3 and 5 under 5 s each; beat 4 (liquid water) cites at least one Web source; beat 6 writes a Report.
  - Record the numbers in the PR body.
- [ ] **Step 3:** Run beat 4 with `OPENAI_SEARCH_MODEL=gpt-6-luna`.
  - If it returns cited sources and is faster, make it the default in `openai_api/models.py` and `.env.example`, then commit `Default web search to gpt-6-luna (measured)`.
  - Otherwise record why it was rejected in `docs/web-search.md`.
- [ ] **Step 4:** Speak "Open TRAPPIST-1" into the app. Expected: the transcript is exact and the reply plays as audio.
- [ ] **Step 5:** Push the branch and open a PR. Its evidence section holds the timings from Steps 2–3 and the smoke output.
