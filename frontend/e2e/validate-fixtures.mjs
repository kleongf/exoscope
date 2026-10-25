import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fixtureReply } from "./voice-fixtures.mjs";
import { waterReply, followUpReply, radiusReply, searchFailureReply } from "./web-fixtures.mjs";

export function validateTurnFixtures() {
  const python =
    process.env.EXOSCOPE_TEST_PYTHON ??
    fileURLToPath(new URL("../../backend/.venv/bin/python", import.meta.url));
  const result = spawnSync(
    python,
    [
      "-c",
      `
import json, sys
from exoscope.agent.models import TurnResponse
fixtures = json.load(sys.stdin)
for fixture in fixtures:
    TurnResponse.model_validate(fixture)
print(f"Validated {len(fixtures)} explicit mock responses against backend TurnResponse")
`,
    ],
    {
      cwd: fileURLToPath(new URL("../../backend/", import.meta.url)),
      input: JSON.stringify([
        fixtureReply,
        waterReply,
        followUpReply,
        radiusReply,
        searchFailureReply,
      ]),
      encoding: "utf8",
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  console.log(result.stdout.trim());
}
