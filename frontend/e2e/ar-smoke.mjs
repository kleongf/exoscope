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
  // Software WebGL on CI (and a busy laptop) can take well over the 15 s default to load the model.
  await page.waitForFunction(() => document.querySelector("model-viewer")?.loaded === true, null, {
    timeout: 60_000,
  });
  const bytes = await page.evaluate(async () => {
    const src = document.querySelector("model-viewer")?.src;
    return src ? (await (await fetch(src)).arrayBuffer()).byteLength : 0;
  });
  assert(bytes > 10_000, `exported GLB too small: ${bytes} bytes`);
  const status = await dialog.getByTestId("ar-status").innerText();
  assert(status.includes("can't start AR"), status);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}ar.png`, timeout: 60_000 });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Close planet properties" }).click();
  console.log(`ar smoke: model built (${bytes} bytes), label honest, unavailable reason shown`);
}
