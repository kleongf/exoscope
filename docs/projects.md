# Projects

A Project saves Systems opened, Samples and their Interpretations, comparisons, conversation
and Web evidence, current scene selection/settings, draft text, and immutable Reports.
New Project starts empty. The header switcher restores another Project; explorer System
buttons reload through the regular live catalog turn, while comparisons reopen their saved
archive data in the chart drawer.

The backend stores one versioned JSON document per Project under `.data/projects/`, plus a
small `current.json` pointer. Set `EXOSCOPE_PROJECT_DIR` to choose another local directory.
The pointer restores the selected Project after page reload and backend restart. Generated
voice audio and browser microphone/player objects are deliberately transient.

All browser operations still use `POST /turn` through the generated API client. A
`project_action` is one of `bootstrap`, `list`, `create`, `load`, or `save`; it is mutually
exclusive with text/audio and never invokes Gemma or a voice provider. Saves include the
last observed revision. Atomic file replacement, fsync and a cross-process lock protect
writes; stale revisions fail rather than overwrite another tab's work.

The UI serializes saves and flushes before switching or submitting a turn. It shows save
failures without replacing the current view. Reload saved Project explicitly discards
unsaved local changes; Retry save retries them. An absent, corrupt, incomplete, or unsafe
Project file is an error, never a silent empty Project.

Comparisons and Samples use the canonical typed models from tickets #8/#9. Their saved
measurements, uncertainties, source papers, exclusions and provenance are retained exactly;
reopening one does not substitute newly fetched System values. The active Sample/comparison
and drawer mode also survive reloads. Interpretation chips remain editable through normal turns.
Saved conversation records and their nested tool steps/Web evidence are validated before restore.

Validation includes process restart, concurrent-worker/stale-write tests, injected filesystem
failures, and a browser flow through autosave, reload, New Project, switching back and
reopening saved comparison/Interpretation evidence. Smoke storage uses a temporary directory.
