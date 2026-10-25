# 01: Smoke test of the model and voice services

**What to build:** A single script, run with the real keys from `.env`, that tells the team whether the services the demo depends on actually work on our accounts. It answers three questions and prints PASS/FAIL for each:

1. Can Gemma 4 (`gemma-4-31b-it`) make a function call and use the returned tool result in a grounded answer?
2. Can Gemma 4 use Gemini's built-in `google_search` **in the same request** as custom function declarations? (If yes, ticket 10 skips the separate grounded call.)
3. Can Grok turn a short audio clip into text, and turn text back into playable audio?

Failures print the real error. Nothing is reported as passing unless it was observed.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One command runs all three checks and prints PASS/FAIL with the error on failure
- [ ] The result of check 2 is recorded in `docs/intent.md` (replacing the "if the smoke test shows" sentence)
- [ ] If check 1 fails, the team is told immediately: the agent design depends on it
- [ ] No keys are printed or committed
