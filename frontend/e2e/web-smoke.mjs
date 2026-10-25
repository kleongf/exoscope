import assert from "node:assert/strict";
import {
  waterReply,
  followUpReply,
  radiusReply,
  searchFailureReply,
  webResult,
} from "./web-fixtures.mjs";

export async function exerciseWeb(page) {
  // Combined flow retains the System, history, scene selection and voice mocks from tickets 01/07.
  await page.unroute("**/api/turn");
  const archive = page.getByRole("table");
  const scene = page.getByTestId("system-view");
  const archiveBefore = await archive.innerText();
  const systemBefore = await scene.innerText();
  const projectSources = page.getByRole("region", { name: "Project Web sources" });
  const history = page.getByTestId("conversation-turn");
  const initialTurns = await history.count();
  const requests = [];
  let nextReply = waterReply;
  let release;
  let releaseSave;
  const saveGate = new Promise((resolve) => {
    releaseSave = resolve;
  });
  let heldSave = false;
  await page.route("**/api/turn", async (route) => {
    const action = route.request().postDataJSON().project_action;
    if (action) {
      if (
        !heldSave &&
        action.operation === "save" &&
        action.state.turns.at(-1)?.question === waterReply.transcript &&
        action.state.turns.at(-1)?.finishedAt !== null
      ) {
        heldSave = true;
        await saveGate;
      }
      return route.continue();
    }
    assert.equal(route.request().method(), "POST");
    requests.push(route.request().postDataJSON());
    const started = performance.now();
    await new Promise((resolve) => {
      release = resolve;
    });
    const reply = structuredClone(nextReply);
    // Actual elapsed time of this local fixture operation, never a provider latency claim.
    if (reply.data.web_search)
      reply.steps = [
        {
          id: `mock-web-${requests.length}`,
          name: "web_search",
          status: reply.data.web_search.status === "ok" ? "completed" : "failed",
          detail: "Explicit local mock response; measured fixture wait",
          elapsed_ms: performance.now() - started,
        },
      ];
    await route.fulfill({ json: reply });
  });
  const submit = async (reply) => {
    nextReply = reply;
    const expectedRequests = requests.length + 1;
    const previousEvidence = await page.getByTestId("web-evidence").count();
    await page.getByLabel("Or type your question").fill(reply.transcript);
    await page.getByRole("button", { name: "Send question" }).click();
    for (let attempt = 0; requests.length < expectedRequests && attempt < 100; attempt++)
      await page.waitForTimeout(10);
    assert.equal(requests.length, expectedRequests);
    assert.equal(requests.at(-1).current_system, "TRAPPIST-1");
    assert.equal(requests.at(-1).text, reply.transcript);
    const current = history.last();
    assert.equal(await current.getByTestId("web-evidence").count(), 0);
    assert.equal(await page.getByTestId("web-evidence").count(), previousEvidence);
    release();
    await page.getByTestId("turn-status").filter({ hasText: "Ready" }).waitFor();
    assert((await current.innerText()).includes(reply.reply_text));
    return current;
  };
  const unchangedArchive = async () => {
    assert.equal(await archive.innerText(), archiveBefore);
    assert.equal(await scene.innerText(), systemBefore);
    assert(!(await archive.innerText()).includes("987.65"));
    assert(!(await scene.innerText()).includes("987.65"));
    assert.equal(await page.locator("table").count(), 1);
  };
  const assertCitationTargets = async (evidence) => {
    const citations = evidence.getByTestId("web-supports").getByRole("link");
    for (const citation of await citations.all()) {
      const href = await citation.getAttribute("href");
      assert.match(await citation.innerText(), /^\[\d+\]$/);
      assert.equal(await evidence.locator(`[id="${href.slice(1)}"]`).count(), 1);
      assert.equal(await page.locator(`[id="${href.slice(1)}"]`).count(), 1);
    }
  };
  const playsBefore = await page.evaluate(() => window.voiceFixture.plays);
  const successful = await submit(waterReply);
  const originalTurnId = await successful.getAttribute("data-turn-id");
  // Address the original article directly: later turns reuse the same source IDs and URLs.
  const originalArticle = page.locator(
    `[data-testid="conversation-turn"][data-turn-id="${originalTurnId}"]`,
  );
  const evidence = originalArticle.getByTestId("web-evidence");
  const source = evidence.getByRole("link", {
    name: "Mock liquid-water evidence page",
    exact: true,
  });
  await source.waitFor();
  assert.equal(await evidence.locator('[data-slot="badge"]').count(), 2);
  await evidence.getByText("science.nasa.gov", { exact: true }).waitFor();
  assert.equal(await source.getAttribute("href"), webResult.sources[0].url);
  assert.equal(
    await evidence.locator("time").first().getAttribute("datetime"),
    webResult.sources[0].retrieved_at,
  );
  assert.equal(await evidence.getByTestId("grounded-text").innerText(), webResult.grounded_text);
  const support = evidence.getByTestId("web-supports");
  assert.equal(await support.locator("p").innerText(), webResult.supports[0].text);
  assert.equal(await support.getByRole("link", { name: "[1]", exact: true }).count(), 1);
  assert.equal(await support.getByRole("link", { name: "[2]", exact: true }).count(), 0);
  assert.equal(
    await evidence
      .getByText("Retrieved only · no claim association returned", { exact: true })
      .count(),
    1,
  );
  await evidence.getByTestId("spoken-attribution").waitFor();
  const studentReply = originalArticle.getByTestId("student-reply");
  assert.equal(await studentReply.innerText(), waterReply.reply_text);
  assert(!(await studentReply.innerText()).includes("Yes, TRAPPIST-1 e"));
  await originalArticle
    .getByText("Gemma synthesis · with archive context", { exact: true })
    .waitFor();
  await evidence
    .getByRole("heading", { name: "Original Grok result · provider support" })
    .waitFor();
  assert((await evidence.innerText()).includes("not to Gemma synthesis"));
  await page.waitForFunction((previous) => window.voiceFixture.plays > previous, playsBefore);
  assert.equal(await evidence.locator("iframe").count(), 0);
  assert.equal(await projectSources.getByTestId("web-sources").locator("li").count(), 2);
  assert(!/web-[a-f0-9]{24}/.test(await evidence.innerText()));
  await assertCitationTargets(evidence);
  await unchangedArchive();
  await evidence
    .getByRole("heading", { name: "Web sources", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: new URL("../../artifacts/web-sources.png", import.meta.url).pathname,
    fullPage: true,
  });

  assert(heldSave, "The completed Web source turn must still be saving");
  const radiusPending = submit(radiusReply);
  await page.getByTestId("turn-status").filter({ hasText: "Processing" }).waitFor();
  releaseSave();
  const radius = await radiusPending;
  assert.equal(await radius.getByTestId("web-evidence").count(), 0);
  assert.equal(await radius.getByRole("list", { name: "Tool steps" }).count(), 0);
  assert.equal(await evidence.count(), 1);
  await assertCitationTargets(evidence);
  await unchangedArchive();

  const followUp = await submit(followUpReply);
  await assertCitationTargets(followUp.getByTestId("web-evidence"));
  await assertCitationTargets(evidence);
  assert.equal(await projectSources.getByTestId("web-sources").locator("li").count(), 3);
  assert.equal(
    await projectSources
      .getByRole("link", { name: "Mock liquid-water evidence page", exact: true })
      .count(),
    1,
  );
  const playsBeforeFailure = await page.evaluate(() => window.voiceFixture.plays);
  const unavailable = await submit(searchFailureReply);
  await unavailable.getByRole("alert").filter({ hasText: searchFailureReply.error }).waitFor();
  assert.equal(await page.evaluate(() => window.voiceFixture.plays), playsBeforeFailure);
  const failedEvidence = unavailable.getByTestId("web-evidence");
  await failedEvidence.getByText(/Web search unavailable/).waitFor();
  assert.equal(await failedEvidence.getByRole("link").count(), 0);
  assert.equal(
    await failedEvidence
      .locator(
        '[data-slot="badge"], iframe, [data-testid="web-supports"], [data-testid="grounded-text"]',
      )
      .count(),
    0,
  );
  assert.equal(await evidence.count(), 1);
  await assertCitationTargets(evidence);
  assert.equal(await projectSources.getByTestId("web-sources").locator("li").count(), 3);
  assert.equal(await history.count(), initialTurns + 4);
  await unchangedArchive();
  console.log(
    "web smoke: explicit MOCKs passed per-turn citations, numeric labels, retrieved-only distinction, spoken attribution, archive-only radius, unavailable current turn with valid history, accumulated Project sources and unchanged System/archive; no provider calls",
  );
}
