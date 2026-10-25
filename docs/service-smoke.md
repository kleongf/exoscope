# Model and voice service smoke checks (ticket 01)

From the repo root, after `cd backend && uv sync`:

```sh
./scripts/smoke-services
# Explicitly use existing configuration elsewhere, without copying it:
./scripts/smoke-services --env-file ../.env
# Optional independent recording (otherwise a TTS-generated seed is used):
./scripts/smoke-services --audio /path/to/clip.wav --expected-transcript 'Open the planet view.'
```

Requires `uv` and Python >=3.12. Calls are live and billable. There are no automatic retries. Each network request has a 60-second timeout. The command runs all three checks even after a failure, prints PASS/FAIL with observed evidence or the redacted real error, and exits 1 if any check fails. Missing `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) or `XAI_API_KEY` is FAIL, never a skipped PASS. Existing environment variables override the explicit dotenv file; no parent file is searched automatically and dotenv interpolation is disabled.

The probes live in `backend/exoscope/service_smoke/`; they are separate from the application agent. Normal `./scripts/verify` runs offline tests and never calls these services.

## Evidence required for PASS

1. **Gemma function/result:** `gemma-4-31b-it` must return exactly one structured `smoke_probe(id="exoscope-smoke")` call. Its validated handler returns a fresh random nonce, absent from the user prompt. The final answer must contain that nonce. This synthetic fixture does not pretend to contain archive data. Function-call IDs, thought signatures, and other returned model parts are preserved in the next request.
2. **Mixed tools:** the same probe with both custom function declarations and `google_search` enabled on every request, plus `include_server_side_tool_invocations=True`. In addition to the nonce, require search queries, HTTP(S) Web sources with titles, and grounding supports that tie a source to text in the final answer. Merely accepting the request or saying "I searched" is insufficient.
3. **Grok voice:** generate a short seed with TTS unless `--audio` is supplied, submit it to STT, compare the transcript with the expected words (case and punctuation insensitive), then synthesize the actual transcript. Require a nonempty, nonsilent, decodable PCM WAV and save it to `artifacts/service-smoke/voice-reply.wav`. A failed rerun removes the previous reply before making requests. The script claims decoding, not listening; use an audio player for manual playback.

Only the observed xAI streaming WAV length sentinel is finalized from the complete HTTP response's actual PCM samples. Finite-size truncated WAVs, incomplete frames, silence, JSON disguised as HTTP 200 audio, and transcript mismatches fail. No missing samples are manufactured.

Provider errors and successful evidence pass through credential redaction before truncation or printing. SDK request logging is disabled; terminal controls and newlines in errors are flattened. Raw request headers, dotenv contents, and raw SDK response dumps are never logged. Audio and the captured local run log are ignored artifacts, not source files.

## Observed live run — 2026-10-25

The explicit parent dotenv configuration contained both required keys. No missing-key assumption was made and no secrets were copied into this repo. The final command was:

```sh
./scripts/smoke-services --env-file ../.env
```

- **Check 1 FAIL:** `ServerError: 500 INTERNAL. {'error': {'code': 500, 'message': 'Internal error encountered.', 'status': 'INTERNAL'}}`. Earlier run: HTTP 504 `DEADLINE_EXCEEDED`, "Deadline expired before operation could complete." No successful function call or grounded answer was observed.
- **Check 2 FAIL:** same HTTP 500 `INTERNAL` on the corrected request. The initial request without the circulation flag returned `400 INVALID_ARGUMENT`: "Please enable tool_config.include_server_side_tool_invocations to use Built-in tools with Function calling." After consulting the combination docs, the script enables that flag. An HTTP 500 does not prove unsupported model capability. Mixed tools remain unverified; the separate-call fallback stays in `intent.md`.
- **Check 3 PASS:** `grok-voice-transcribe-2.0` returned exactly "Open the planet view."; TTS `eve` produced a 1.27-second, mono, 24 kHz, 16-bit PCM WAV (60,960 sample bytes). `afinfo` recognized it and `afplay` exited 0. Default input was synthesized speech, not a microphone recording. An initial validator rejected xAI's streaming length sentinel; the final probe handles that observed format and completed the full round-trip.

Local evidence: `artifacts/service-smoke/live-run.log`, `voice-input.wav`, and `voice-reply.wav`. Overall live command exit: **1**, because checks 1 and 2 failed. No separate search-only probe was performed.

## Integration notes for ticket 07

- Use server-side `POST https://api.x.ai/v1/stt` with Bearer auth and multipart fields `model=grok-voice-transcribe-2.0`, `language=en`, `format=true`, then the `file` part last. The transcript is the JSON `text` field. The API accepts WAV and WebM; browser recording still needs its own test.
- Use `POST https://api.x.ai/v1/tts` with `text` set to the actual reply, `voice_id="eve"`, `language="en"`, and `output_format={"codec":"wav","sample_rate":24000}`. Without timestamps, the response is raw audio bytes, not JSON/base64. These REST endpoints do not require an invented `grok-tts` model name or an OpenAI-style `/audio/speech` endpoint.
- The observed WAV advertised RIFF length `0x80000023` and data length `0x7fffffff`; finalize only those sentinels after receiving the complete HTTP body before saving finite playback files. `finalise_wav` is tested for this behavior. Check browser playback separately.
- This ticket adds no microphone UI, backend audio endpoint, or turn integration. Ticket 07 still depends on ticket 04. Retain the text fallback on service failure.

## Integration notes for ticket 10

- Preserve `web_search` as a custom tool whose handler makes a separate search-only call; it remains unverified on this account. A provider HTTP 500 should produce an honest failure, not fabricated Web sources.
- Use `client.models.generate_content` with the documented `gemma-4-31b-it` identifier and `types.Tool(google_search=types.GoogleSearch())` for the separate call. Read `candidates[0].grounding_metadata.grounding_chunks[].web.{title,uri}` and grounding supports. Do not substitute another model silently.
- If retesting combination later, enable `types.ToolConfig(include_server_side_tool_invocations=True)` and circulate all returned `tool_call`, `tool_response`, function-call IDs, and thought signatures. Request acceptance alone is insufficient. Rerun the smoke command before changing the architecture.
- Live function calling is also unverified, so ticket 04's agent loop cannot be considered ready on the evidence from ticket 01. Ticket 10 still depends on ticket 04.

## Official references consulted

- [Gemma on the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api): hosted Gemma model identifiers, function declarations, and Google Search examples.
- [Combining built-in tools and function calling](https://ai.google.dev/gemini-api/docs/generate-content/tool-combination): the circulation flag and preserving returned tool context. Its examples use Gemini; this is not evidence that the Gemma mixed request succeeded.
- [xAI speech to text](https://docs.x.ai/developers/model-capabilities/audio/speech-to-text): REST endpoint, multipart order, transcription model, and response fields.
- [xAI text to speech](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech): REST endpoint, `eve`, raw WAV output, and codec options.

## Validation

Offline tests exercise positive and negative function-call/nonce evidence, complete versus missing search grounding, real HTTP errors from every voice stage, transcript mismatches, invalid/silent/truncated WAVs, streaming header finalization, dotenv precedence, missing keys, credential redaction, and continuing all checks after failure. No network or service keys are used by these tests.

`./scripts/verify` passed on macOS with pnpm 10 (the CI version): backend format/lint/strict types/tests, generated API checks, frontend format/types/lint/test/build, and Playwright app smoke. `artifacts/smoke.png` was inspected: the existing starter canvas with a centered orange sphere on a dark background. `artifacts/console.log` contained no errors: only the existing Three.Clock deprecation and WebGL ReadPixels performance warnings. The build also reported a large bundle warning. These observations do not establish that tickets 07 or 10 exist.
