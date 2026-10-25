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
  const system = fixtureReply.data.system;
  const comparison = {
    id: 1,
    comparison: {
      x: { property: "radius", label: "Radius", unit: "Earth radii" },
      y: { property: "insolation", label: "Insolation", unit: "Earth flux" },
      rows: system.planets.map((planet) => ({
        planet: planet.name,
        hostname: system.hostname,
        x: planet.radius,
        y: planet.insolation,
        excluded:
          planet.radius.status === "missing"
            ? "missing_x"
            : planet.insolation.status === "missing"
              ? "missing_y"
              : null,
      })),
      provenance: [{ hostname: system.hostname, provenance: system.provenance }],
      notes: [],
    },
  };
  const sample = {
    id: 1,
    sample: {
      filters: [{ field: "radius", op: "<", value: 2, upper: null }],
      interpretations: [{ term: "small", as: "radius under 2 Earth radii", caveat: null }],
      sort: null,
      limit: 20,
      fields: [{ name: "radius", label: "Radius", unit: "Earth radii" }],
      planets: system.planets
        .filter((p) => p.radius.status === "measured")
        .map((p) => ({ name: p.name, hostname: system.hostname, values: { radius: p.radius } })),
      matched: 1,
      truncated: false,
      excluded: { count: 1, by_field: { radius: 1 }, reason: "Missing radius" },
      provenance: system.provenance,
      notes: [],
    },
  };
  await call({
    operation: "save",
    id: current.id,
    revision: current.revision,
    state: {
      ...current.state,
      loadedSystems: [...current.state.loadedSystems, other],
      comparisons: [comparison],
      samples: [sample],
      daysPerSecond: 12,
      draft: "A saved draft",
    },
  });
  await page.reload();
  const explorer = page.getByRole("complementary", { name: "Project explorer" });
  await explorer.getByRole("button", { name: /TOI-700/ }).waitFor();
  await explorer.getByRole("button", { name: /^TRAPPIST-1/ }).waitFor();
  await explorer.getByTestId("sample-item").waitFor();
  const sampleGroup = explorer.getByRole("button", { name: "Samples (1)", exact: true });
  await sampleGroup.click();
  await page.getByTestId("project-save-status").filter({ hasText: "Project saved" }).waitFor();
  await page.reload();
  await sampleGroup.waitFor();
  assert.equal(await sampleGroup.getAttribute("aria-expanded"), "false");
  assert.equal(await explorer.getByTestId("sample-item").isVisible(), false);
  await sampleGroup.click();
  await explorer.getByTestId("sample-item").waitFor();

  assert.equal(await page.getByLabel("Or type your question").inputValue(), "A saved draft");
  await explorer.getByTestId("comparison-item").click();
  await page.getByTestId("compare-workspace").waitFor();
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
  await page.getByTestId("compare-workspace").waitFor();
  await page
    .getByTestId("compare-workspace")
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
