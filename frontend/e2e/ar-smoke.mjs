import assert from "node:assert/strict";

// Desktop Chromium can't enter AR, so this checks everything up to the hand-off:
// the model is built and displayed, the label is honest, and the reason AR is unavailable is shown.
export async function exerciseAr(page, outDir) {
  await page.getByRole("cell").getByRole("button", { name: "TRAPPIST-1 b", exact: true }).click();
  const card = page.getByTestId("planet-card");
  await card.getByRole("button", { name: "View in AR" }).click();
  const dialog = page.getByTestId("ar-dialog");
  await dialog.waitFor();
  const label = await dialog.getByTestId("ar-label").innerText();
  assert(label.includes("Radius: 1.116 −0.012 / +0.014 Earth radii"), label);
  assert(label.includes("not a photograph"), label);
  await page.waitForFunction(() => document.querySelector("model-viewer")?.loaded === true);
  const bytes = await page.evaluate(async () => {
    const src = document.querySelector("model-viewer")?.src;
    return src ? (await (await fetch(src)).arrayBuffer()).byteLength : 0;
  });
  assert(bytes > 10_000, `exported GLB too small: ${bytes} bytes`);
  const status = await dialog.getByTestId("ar-status").innerText();
  assert(status.includes("can't start AR"), status);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}ar.png` });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Close planet properties" }).click();
  console.log(`ar smoke: model built (${bytes} bytes), label honest, unavailable reason shown`);
}

// The System miniature: frozen at the current simulated time, with the System view's badge.
export async function exerciseArSystem(page, outDir) {
  await page.getByRole("button", { name: "View System in AR" }).click();
  const dialog = page.getByTestId("ar-system-dialog");
  await dialog.waitFor();
  const label = await dialog.getByTestId("ar-system-label").innerText();
  for (const expected of [
    "TRAPPIST-1 · schematic model",
    "(simulated date)",
    "System is edge-on from Earth",
    "Planet sizes ×25, star ×3",
    "Not an N-body simulation",
  ]) {
    assert(label.includes(expected), `missing "${expected}" in:\n${label}`);
  }
  await page.waitForFunction(() => document.querySelector("model-viewer")?.loaded === true);
  const bytes = await page.evaluate(async () => {
    const src = document.querySelector("model-viewer")?.src;
    return src ? (await (await fetch(src)).arrayBuffer()).byteLength : 0;
  });
  assert(bytes > 50_000, `exported System GLB too small: ${bytes} bytes`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}ar-system.png` });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  console.log(`ar system smoke: model built (${bytes} bytes), badge and frozen date on the model`);
}
