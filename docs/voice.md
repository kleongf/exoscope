# Push-to-talk and the shared turn path

Hold **Hold to talk** with a pointer, Space, or Enter; release to send. Escape cancels. Microphone permission, recording, and processing have separate visible states. The text input remains available as the fallback after speech errors. Recording is limited to 30 seconds and 8 MiB in the browser; the server validates the actual container and limits decoded uploads to 10 MiB.

All input uses `POST /turn`. Audio is transcribed server-side, then runs through the same Gemma tool loop as typed input. Commands are applied before reply playback. A denied autoplay request exposes a Play button. Starting another recording stops the previous reply and releases its object URL. Permission grants arriving after release cannot start an abandoned recording.

STT failure prevents downstream model/tool work. Agent failure retains the recognized transcript. TTS failure retains the completed text, commands, and catalog evidence, with an audio warning. Keys stay server-side. The app can start without keys.

Ticket 07 uses the canonical ticket 02 catalog and ticket 03 shadcn controls, adding the bounded Gemma loop, typed System loading, and voice/text turn path. The variant A layout places the Project explorer on the left, System view and chart drawer in the centre, and conversation on the right. A selected planet's canonical quantities appear in a floating card. This is not the complete comparison, Sample search, Project persistence, or Keplerian orbit work.

The canonical `System` payload carries `hostname`, `star`, `planets`, `provenance`, and `notes`. Each quantity explicitly distinguishes a measurement from missing data, with units, uncertainties, and its source paper. The duplicate loader and demo Snapshot have been removed. Returned tool-step timings measure operations that actually ran; waiting for the single `/turn` response is not presented as simulated tool progress.

## Historical verification before latest-main integration — 2026-10-25

- `./scripts/verify` passed: 149 backend tests, 17 frontend tests, formatting, lint, strict types, generated API, production build, and browser smoke.
- Screenshot and console were inspected: the explicit browser fixture rendered, with zero console errors and existing Three.js/WebGL warnings.
- Browser fixtures exercised pointer and keyboard recording, complete chunk capture, late permission, cancellation, processing state, commands before playback, blocked playback/replay, playback cleanup, speech failure, and typed fallback. The compact scene fixture contains two planets and an intentionally missing value; it is not live NASA or Gemma evidence.
- A separate live NASA exercise resolved ` trappist- 1 ` to TRAPPIST-1 and loaded all seven planets with Live provenance in 2.46 seconds. The initial duplicate Snapshot was superseded by ticket 02's canonical Snapshots during integration.
- Ticket 01 separately observed a working live Grok STT/TTS round trip and decoded playback. Browser voice tests use controlled microphone, recorder, and provider fixtures; an end-to-end live microphone/model success has not been observed.
- Original 31B Gemma calls returned HTTP 500/504. Following the authorized 26B configuration change and spoken-name guidance, a live synthetic-speech backend turn passed in 8.61 seconds: recognized transcript “Open Trappist One.”, canonical TRAPPIST-1, seven Live planets, one System command, no error or warnings, and 53,520 decoded reply-audio frames. The browser recording path is independently exercised with controlled fixtures; a physical microphone rehearsal has not been observed.

The backend review found that a failed refresh of the current System could block opening a different System. That refresh now produces a warning, and a regression test verifies that a System available in the Snapshot can still be opened.

## Latest-main integration verification

After rebasing onto `fd7dc91`, `./scripts/verify` passed with 166 backend tests and 24 frontend tests, plus generated API checks, formatting, lint, strict types, production build, and browser smoke. The screenshot and console were inspected; there were zero console errors.

The browser exercise verifies left Project explorer / centre System view / right conversation layout, a floating selected-planet card, canonical names and quantities, source-paper tooltips, uncertainties, explicit missing values, chart drawer, conversation history, measured tool timings, responsive layout, and the existing voice recovery scenarios. Clicking an opened System issues a new `/turn` request rather than relabelling an in-memory copy as fresh data.

The canonical ticket 02 loader, models, Snapshots, and tests are preserved. No vendored shadcn controls were edited; obsolete standalone layout styles were removed. Later ticket 10 adds xAI Web sources to the shared turn path.
