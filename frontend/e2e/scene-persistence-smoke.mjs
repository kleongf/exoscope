import assert from "node:assert/strict";

/** Parent smoke runner calls this after loading a System with real Project storage. */
export async function exerciseScenePersistence(page) {
  const scene = page.getByTestId("orbit-scene");
  const saved = page.getByTestId("project-save-status").filter({ hasText: "Project saved" });
  const projectAction = async (project_action) => {
    const reply = await page.request.post(new URL("/api/turn", page.url()).href, {
      data: { project_action },
    });
    const body = await reply.json();
    assert.equal(body.error, null, body.error);
    return body.project_result.current;
  };
  const switchLayer = async (name, checked) => {
    const control = scene.getByRole("switch", { name, exact: true });
    if ((await control.getAttribute("aria-checked")) !== String(checked)) await control.click();
  };
  await scene.waitFor();
  if (await scene.getByRole("button", { name: "Pause", exact: true }).count()) {
    await scene.getByRole("button", { name: "Pause", exact: true }).click();
  }
  await switchLayer("Orbit uncertainty", false);
  await switchLayer("Position uncertainty", false);
  await switchLayer("Assumptions", false);
  await switchLayer("True sizes", true);
  await switchLayer("Planet labels", false);
  await scene
    .getByRole("group", { name: "Colour planets by" })
    .getByRole("button", { name: "Radius", exact: true })
    .click();
  await scene.getByRole("button", { name: "2 d/s", exact: true }).click();
  // Selecting a speed resumes play; pause before checking an exact restored date.
  await scene.getByRole("button", { name: "Pause", exact: true }).click();
  await saved.waitFor();
  const current = await projectAction({ operation: "bootstrap" });
  assert.equal(current.state.sceneSettings.sceneState.playing, false);
  assert.equal(current.state.sceneSettings.sceneState.showLabels, false);
  assert.equal(current.state.sceneSettings.sceneState.colorBy, "radius");
  assert.deepEqual(current.state.sceneSettings.orbitLayers, {
    orbitBands: false,
    positionSpread: false,
    assumptions: false,
    trueSizes: true,
  });
  assert.equal(current.state.daysPerSecond, 2);
  assert(Number.isFinite(current.state.sceneSettings.simulatedJulianDate));

  // A deterministic stored date proves the clock restores rather than starting at now.
  const jd = 2460000.5;
  await projectAction({
    operation: "save",
    id: current.id,
    revision: current.revision,
    state: {
      ...current.state,
      sceneSettings: { ...current.state.sceneSettings, simulatedJulianDate: jd },
    },
  });
  const dateText =
    new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const assertRestored = async () => {
    await scene.getByRole("button", { name: "Play", exact: true }).waitFor();
    await scene.getByText(dateText, { exact: true }).waitFor();
    for (const [name, expected] of [
      ["Orbit uncertainty", false],
      ["Position uncertainty", false],
      ["Assumptions", false],
      ["True sizes", true],
      ["Planet labels", false],
    ]) {
      assert.equal(
        await scene.getByRole("switch", { name, exact: true }).getAttribute("aria-checked"),
        String(expected),
      );
    }
    assert.equal(
      await scene
        .getByRole("group", { name: "Colour planets by" })
        .getByRole("button", { name: "Radius", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await saved.waitFor();
  };
  await page.reload();
  await assertRestored();
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  await page.getByText("Open a System to explore its planets.", { exact: true }).waitFor();
  await saved.waitFor();
  const empty = await projectAction({ operation: "bootstrap" });
  assert.equal(empty.state.system, null);
  assert.equal(empty.state.sceneSettings.simulatedJulianDate, undefined);
  assert.equal(empty.state.sceneSettings.orbitLayers, undefined);
  await page.getByRole("button", { name: "Switch Project", exact: true }).click();
  await page.getByRole("button", { name: current.title, exact: true }).click();
  await assertRestored();
  console.log(
    "Scene persistence smoke: manual controls, honesty layers and a paused Julian date survive reload and Project switching; New Project is empty.",
  );
}
