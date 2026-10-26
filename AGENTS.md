# ExoScope

Read [docs/intent.md](docs/intent.md) before working. Use the vocabulary in [GLOSSARY.md](GLOSSARY.md) exactly.

## Verify

```
./scripts/verify          # everything, incl. launching the app + Playwright screenshot
./scripts/verify --no-app # checks only
```

**Done** means: `./scripts/verify` passes **and** you exercised the change yourself — look at `artifacts/smoke.png` and `artifacts/console.log` (extend `frontend/e2e/smoke.mjs` to click through your feature).

## Layout

- `backend/exoscope/<feature>/` — Python (uv, FastAPI, Pydantic v2). Features: `catalog`, `scene`, `compare`, `report`, `agent`, `voice`, `websearch`.
- `frontend/src/features/<feature>/` — React + strict TS, React Three Fiber, Plotly, zustand.
- One directory per feature. New feature → new directory, not a new section in an existing file.

## Conventions

- `catalog` is the only code that touches TAP or a Snapshot. Everything else asks `catalog`.
- The model never writes SQL or code. Filters are allowlisted fields; the backend builds ADQL.
- The frontend talks to the backend only through `src/api/client.ts`: `POST /turn` for everything the student asks, plus `GET /projects`, `POST /projects` and `GET /projects/{id}` for the Project switcher; Reports use `POST /projects/{id}/reports` and `GET /reports/{filename}` for immutable HTML. Its types are generated: after changing backend models run `cd frontend && pnpm gen:api` and commit the result. Never hand-write API types.
- `ui_commands` are Pydantic models in `backend/exoscope/scene/commands.py`; anything that reaches the browser is validated there first.
- Frontend state lives in the single zustand store (`src/store/store.ts`) and changes only by applying a `ui_command` or a user-interaction action.
- Every number shown or exported carries its unit and its provenance (Live result or Snapshot, source paper). Missing is shown as missing, never zero.
- UI controls come from shadcn/ui (Radix): add them with `pnpm dlx shadcn@latest add <name>`; never hand-roll a control shadcn provides, and never edit `src/components/ui/` (vendored).
- Files stay under 300 lines (enforced). Split by responsibility.
- Secrets live in `.env` (see `.env.example`), server-side only. The app must start without them.
