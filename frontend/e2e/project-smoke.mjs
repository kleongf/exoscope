import assert from "node:assert/strict";
import { fixtureReply } from "./voice-fixtures.mjs";

export async function exerciseProjects(page) {
  await page.unroute("**/api/turn");
  const call = async (project_action) => {
    const response = await page.request.post("http://127.0.0.1:5173/api/turn", {
      data: { project_action },
    });
    const body = await response.json();
    assert.equal(body.error, null, body.error);
    return body.project_result;
  };
  await page.getByTestId("project-save-status").filter({ hasText: "Project saved" }).waitFor();
  const { current } = await call({ operation: "bootstrap" });
  assert(current.state.turns.length >= 8, "Conversation and Web sources saved to backend");
  const other = structuredClone(fixtureReply.data.system);
  other.hostname = "TOI-700";
  other.star.hostname = "TOI-700";
  other.planets = [];
  const comparison = {
    id: "radius-fixture",
    title: "Radius and irradiation",
    x: "radius",
    y: "insolation",
    system_ids: ["TRAPPIST-1"],
  };
  await call({
    operation: "save",
    id: current.id,
    revision: current.revision,
    state: {
      ...current.state,
      loadedSystems: [...current.state.loadedSystems, other],
      comparisons: [comparison],
      samples: [
        {
          id: "small-fixture",
          title: "Small planets",
          interpretations: ["radius under 2 Earth radii"],
        },
      ],
      daysPerSecond: 12,
      draft: "A saved draft",
    },
  });
  await page.reload();
  const explorer = page.getByRole("complementary", { name: "Project explorer" });
  await explorer.getByRole("button", { name: /TOI-700/ }).waitFor();
  await explorer.getByRole("button", { name: /TRAPPIST-1/ }).waitFor();
  await explorer.getByText("radius under 2 Earth radii", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Or type your question").inputValue(), "A saved draft");
  await explorer.getByRole("button", { name: "Radius and irradiation", exact: true }).click();
  await page.getByRole("region", { name: "Saved comparison" }).waitFor();
  await page.getByTestId("project-save-status").filter({ hasText: "Project saved" }).waitFor();
  await explorer.getByRole("button", { name: "New Project", exact: true }).click();
  await explorer.getByText("Systems you open appear here.", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("conversation-turn").count(), 0);
  await explorer.getByRole("button", { name: "Switch Project" }).click();
  await page.getByRole("button", { name: current.title, exact: true }).click();
  await explorer.getByRole("button", { name: /TOI-700/ }).waitFor();
  assert.equal(await page.getByTestId("conversation-turn").count(), current.state.turns.length);
  await page.reload();
  await explorer.getByRole("button", { name: /TOI-700/ }).waitFor();
  await page.getByRole("region", { name: "Saved comparison" }).waitFor();
  await page
    .getByRole("region", { name: "Saved comparison" })
    .locator(".js-plotly-plot .main-svg")
    .first()
    .waitFor();
  await page
    .getByTestId("system-view")
    .getByRole("button", { name: "TRAPPIST-1 b", exact: true })
    .waitFor();
  await page.waitForTimeout(300);
  console.log(
    "Projects smoke: real JSON backend retained evidence, restored after reload, created empty Project, switched back, reopened comparison and Interpretation chips; archive/provider responses remain explicit fixtures",
  );
}
