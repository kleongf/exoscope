import assert from "node:assert/strict";
import { fixtureReply, installVoiceFixtures } from "./voice-fixtures.mjs";

// Overridable so parallel worktrees can run the smoke on other ports.
const WEB_URL = process.env.EXO_WEB_URL ?? "http://127.0.0.1:5173";

const visibleText = async (page, testid, expected) => {
  await page.waitForFunction(
    ({ testid, expected }) =>
      document.querySelector(`[data-testid="${testid}"]`)?.textContent?.includes(expected),
    { testid, expected },
  );
};
export async function exerciseVoice(page) {
  await installVoiceFixtures(page);
  const requests = [];
  let releaseResponse;
  let failure = false;
  await page.route("**/api/turn", async (route) => {
    if (route.request().postDataJSON().project_action) return route.continue();
    const request = route.request();
    assert.equal(request.method(), "POST");
    const headers = request.headers();
    for (const name of Object.keys(headers))
      assert(
        !/authorization|api[-_]?key/i.test(name),
        "Browser request must not carry provider credentials",
      );
    const url = new URL(request.url());
    assert.equal(url.origin, WEB_URL);
    assert.equal(url.search, "");
    const body = request.postDataJSON();
    assert(Object.keys(body).every((key) => ["text", "audio", "current_system"].includes(key)));
    requests.push(body);
    await new Promise((resolve) => {
      releaseResponse = resolve;
    });
    const reply = failure
      ? {
          transcript: "",
          reply_text: "",
          reply_audio: null,
          ui_commands: [],
          data: { system: null },
          error: "Speech recognition failed. Please type your question instead.",
          warnings: [],
        }
      : requests.length === 3
        ? {
            ...fixtureReply,
            steps: [
              {
                id: "failed-lookup",
                name: "load_system",
                status: "failed",
                detail: "Explicit unknown-name fixture",
                elapsed_ms: 100,
              },
              ...fixtureReply.steps,
            ],
          }
        : fixtureReply;
    await route.fulfill({ json: reply });
  });
  page.on("request", (request) => {
    assert(
      !/api\.x\.ai|generativelanguage\.googleapis\.com/.test(request.url()),
      "Provider calls must stay on the backend",
    );
  });
  await page.goto(`${WEB_URL}/`);
  const talk = page.getByTestId("push-to-talk");
  // Release before permission resolves: late grant must stop tracks, never record or send.
  await page.evaluate(() => {
    window.voiceFixture.delayPermission = true;
  });
  await talk.focus();
  await page.keyboard.down("Space");
  await visibleText(page, "turn-status", "Requesting");
  await page.keyboard.up("Space");
  await page.evaluate(() => {
    window.voiceFixture.grant();
    window.voiceFixture.delayPermission = false;
  });
  await page.waitForFunction(() => window.voiceFixture.stops > 0);
  assert.equal(requests.length, 0);
  assert.equal(await page.evaluate(() => window.voiceFixture.recordings), 0);
  // Actual pointer hold/release drives the MediaRecorder lifecycle.
  const bounds = await talk.boundingBox();
  assert(bounds);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await visibleText(page, "turn-status", "Recording");
  assert.equal(requests.length, 0);
  await page.mouse.up();
  await visibleText(page, "turn-status", "Processing");
  for (let attempt = 0; requests.length < 1 && attempt < 100; attempt++)
    await page.waitForTimeout(10);
  assert.equal(requests.length, 1);
  assert.equal(atob(requests[0].audio.data_base64), "fixture-start-fixture-final");
  assert.equal(requests[0].audio.mime_type, "audio/webm;codecs=opus");
  assert.equal(requests[0].current_system, null);
  assert.equal(await page.getByRole("list", { name: "Tool steps" }).count(), 0);
  await page.getByText("Waiting for response…", { exact: false }).waitFor();
  releaseResponse();
  await visibleText(page, "transcript", "Open TRAPPIST-1");
  await page.getByRole("heading", { name: "TRAPPIST-1", exact: true }).waitFor();
  await page.getByText("Cached · Snapshot 2026-10-25", { exact: true }).first().waitFor();
  assert.equal(await page.locator("tbody tr").count(), 2);
  assert.equal(
    await page.getByRole("cell", { name: "Missing (Earth radii)", exact: true }).count(),
    1,
  );
  const replay = page.getByRole("button", { name: "Play spoken reply", exact: true });
  await replay.waitFor();
  assert.equal(await page.evaluate(() => window.voiceFixture.loadBeforePlay), true);
  await page.evaluate(() => {
    window.voiceFixture.allowPlay = true;
  });
  await replay.click();
  await page.getByText("Playing spoken reply", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.voiceFixture.plays), 2);
  const previousPlayback = await page.evaluate(() => ({
    pauses: window.voiceFixture.pauses,
    revokes: window.voiceFixture.revokes,
  }));
  // Keyboard cancellation discards captured audio.
  await talk.focus();
  await page.keyboard.down("Space");
  await visibleText(page, "turn-status", "Recording");
  await page.waitForFunction(
    (previous) =>
      window.voiceFixture.pauses > previous.pauses &&
      window.voiceFixture.revokes > previous.revokes,
    previousPlayback,
  );
  assert.equal(await page.getByRole("heading", { name: "TRAPPIST-1", exact: true }).count(), 1);
  await visibleText(page, "transcript", "Open TRAPPIST-1");
  await page.keyboard.press("Escape");
  await page.keyboard.up("Space");
  await visibleText(page, "turn-status", "Ready");
  assert.equal(requests.length, 1);
  // Speech service failure returns a useful error, then the same input path accepts text.
  failure = true;
  await page.keyboard.down("Enter");
  await visibleText(page, "turn-status", "Recording");
  await page.keyboard.up("Enter");
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="turn-status"]')?.textContent?.includes("Processing"),
  );
  for (let attempt = 0; requests.length < 2 && attempt < 100; attempt++)
    await page.waitForTimeout(10);
  assert.equal(requests.length, 2);
  releaseResponse();
  await page.getByRole("alert").filter({ hasText: "Speech recognition failed" }).waitFor();
  failure = false;
  await page.getByLabel("Or type your question").fill("Open TRAPPIST-1");
  await page.getByRole("button", { name: "Send question" }).click();
  for (let attempt = 0; requests.length < 3 && attempt < 100; attempt++)
    await page.waitForTimeout(10);
  assert.equal(requests.length, 3);
  assert.equal(requests[2].text, "Open TRAPPIST-1");
  assert.equal(requests[2].current_system, "TRAPPIST-1");
  assert.equal(requests[2].audio, undefined);
  releaseResponse();
  await visibleText(page, "reply", "explicitly mocked");
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.getByLabel("Or type your question").isVisible());
  assert(await talk.isVisible());
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log(
    "voice smoke: MOCK fixtures passed hold/release, full capture, late permission, cancellation, commands-before-playback, replay, STT error and typed fallback; no live model calls",
  );
}
