# ExoScope

A student exoplanet Project workbench with a System view, typed questions, and push-to-talk speech. See [the product intent](docs/intent.md) and [the vocabulary](GLOSSARY.md).

## Run locally

Use Python 3.12+, Node.js, uv, and pnpm 10. Install dependencies:

```sh
cd backend
uv sync
cd ../frontend
pnpm install --frozen-lockfile
pnpm gen:api
```

Start the backend in one terminal:

```sh
cd backend
uv run uvicorn exoscope.app:app --host 127.0.0.1 --port 8000
```

Start the frontend in another:

```sh
cd frontend
pnpm dev
```

Open http://127.0.0.1:5173. The browser uses `/api/turn`, which Vite forwards to the backend's `POST /turn`.

Copy `.env.example` to the repository's `.env` and configure the server-side keys to enable model and speech calls. The app starts without keys and explains which service is unavailable. To reuse an existing configuration file, set `EXOSCOPE_ENV_FILE` explicitly before starting the backend; relative paths resolve from this repository, independently of the shell's working directory. Existing process variables take precedence. Keys never belong in frontend configuration.

## Service readiness

Run `./scripts/smoke-services` to repeat the original Gemma/Grok diagnostics. The command retains its original 31B model default; use `--model gemma-4-26b-a4b-it` to test 26B explicitly. [Service evidence and integration notes](docs/service-smoke.md) distinguish observed live results from mocked tests.

On 2026-10-25, Grok's STT/TTS round trip passed. Original `gemma-4-31b-it` tool requests returned HTTP 500/504 errors; the app now uses `gemma-4-26b-a4b-it`, as settled in the current product intent. A later live synthetic-speech turn transcribed “Open Trappist One,” loaded seven TRAPPIST-1 planets with Live provenance, and returned validated reply audio in 8.61 seconds. This is provider/backend evidence, not a physical microphone rehearsal.

The agent calls the canonical ticket 02 catalog through `exoscope.catalog.load_system`. It reads NASA's `pscomppars` table with bounded requests and dated TRAPPIST-1/TOI-700 Snapshot fallback, preserving uncertainties, units, source papers, and explicit missing quantities. There is one production catalog loader. Snapshot results are labelled as cached, and missing values stay missing.

Questions beyond archive coverage can request xAI Web search. Sources stay attached to their conversation turn and accumulate in the Project explorer; they never replace archive numbers. Each turn permits one search attempt with a 15-second deadline and an honest unavailable result on failure. See [Web search evidence and limits](docs/web-search.md).

## Verify changes

```sh
./scripts/verify
```

This runs backend checks/tests, regenerates API types, checks/builds the frontend, and launches a browser smoke exercise. Inspect `artifacts/smoke.png` and `artifacts/console.log` afterward. Browser fixtures exercise controlled scenarios; service smoke checks make separate live requests. Use `./scripts/verify --no-app` for checks without the browser exercise.
