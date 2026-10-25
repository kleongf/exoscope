import assert from "node:assert/strict";
import { fixtureReply } from "./voice-fixtures.mjs";

export async function exerciseLayout(page) {
  const explorer = page.getByRole("complementary", { name: "Project explorer" });
  const chat = page.getByRole("complementary", { name: "Project chat" });
  const scene = page.getByTestId("system-view");
  const bounds = await Promise.all([
    explorer.boundingBox(),
    scene.boundingBox(),
    chat.boundingBox(),
  ]);
  assert(bounds.every(Boolean));
  assert(
    bounds[0].x < bounds[1].x && bounds[1].x < bounds[2].x,
    "Project, System view, chat must run left to right",
  );
  assert.equal(await page.getByTestId("planet-card").count(), 0);
  await page.getByRole("cell").getByRole("button", { name: "TRAPPIST-1 b", exact: true }).click();
  const card = page.getByTestId("planet-card");
  await card.waitFor();
  assert((await card.innerText()).includes("1.116 −0.012 / +0.014 Earth radii"));
  const cardBounds = await card.boundingBox();
  const sceneBounds = await scene.boundingBox();
  assert(cardBounds && sceneBounds);
  assert(
    cardBounds.x >= sceneBounds.x &&
      cardBounds.x + cardBounds.width <= sceneBounds.x + sceneBounds.width + 1,
  );
  assert(cardBounds.y >= sceneBounds.y && cardBounds.y < sceneBounds.y + 30);
  await card.getByText("1.116 −0.012 / +0.014 Earth radii", { exact: true }).focus();
  await page.getByRole("tooltip").getByRole("link", { name: "Agol et al. 2021" }).waitFor();
  await page.getByRole("button", { name: "Close planet properties" }).click();
  assert.equal(await card.count(), 0);
  // Select through the actual scene label; names match the canonical archive ID.
  // Labels ride along with orbiting planets, so pause time first to give a stable target.
  await scene.getByRole("button", { name: "Pause" }).click();
  // A projected label can sit beneath the honesty controls; activate its keyboard action.
  const planetLabel = scene.getByRole("button", { name: "TRAPPIST-1 e", exact: true });
  await planetLabel.focus();
  await planetLabel.press("Enter");
  await card.getByText("TRAPPIST-1 e", { exact: true }).waitFor();
  assert((await card.innerText()).includes("Missing (Earth radii)"));
  await page.getByRole("button", { name: "Close planet properties" }).click();
  await page.getByRole("button", { name: "Chart & table" }).click();
  await page.getByText("No comparison or Sample yet.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Chart & table" }).click();
  assert.equal(await page.getByTestId("conversation-turn").count(), 3);
  assert(
    (await chat.innerText()).includes("1.2 s"),
    "Only fixture-provided tool timings should appear",
  );
  assert((await chat.innerText()).includes("Nothing in the view was changed."));
  assert(
    (await chat.innerText()).includes(
      "Some steps failed; successful changes are shown in the view.",
    ),
  );
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await explorer.isVisible());
    assert(await chat.isVisible());
    assert(await page.getByLabel("Or type your question").isVisible());
    assert(await page.getByTestId("push-to-talk").isVisible());
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "Responsive layout must not overflow horizontally",
    );
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.unroute("**/api/turn");
  const reloads = [];
  await page.route("**/api/turn", async (route) => {
    if (route.request().postDataJSON().project_action) return route.continue();
    reloads.push(route.request().postDataJSON());
    await route.fulfill({ json: fixtureReply });
  });
  await explorer.getByRole("button", { name: /TRAPPIST-1/ }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="conversation-turn"]').length === 4,
  );
  await page.getByTestId("turn-status").filter({ hasText: "Ready" }).waitFor();
  assert.deepEqual(reloads, [{ text: "Open TRAPPIST-1", current_system: "TRAPPIST-1" }]);
  console.log(
    "layout smoke: three panels, canonical selection, floating card, units/uncertainties/source tooltips, missing values, drawer, history and responsive layout",
  );
}
