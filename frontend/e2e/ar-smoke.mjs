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

  await card.getByRole("button", { name: "Compare with Earth in AR" }).click();
  const comparison = page.getByTestId("ar-compare-dialog");
  await comparison.waitFor();
  const comparisonLabels = await comparison.getByTestId("ar-compare-label").allInnerTexts();
  assert(comparisonLabels.some((label) => label.includes("Standard reference value")));
  assert(comparisonLabels.some((label) => label.includes("Source paper: Agol et al. 2021")));
  assert(comparisonLabels.some((label) => label.includes("±1σ range")));
  await page.waitForFunction(() => document.querySelector("model-viewer")?.loaded === true);
  const comparisonBytes = await page.evaluate(async () => {
    const src = document.querySelector("model-viewer")?.src;
    return src ? (await (await fetch(src)).arrayBuffer()).byteLength : 0;
  });
  assert(comparisonBytes > bytes, "comparison GLB should contain both bodies and their labels");
  await page.screenshot({ path: `${outDir}ar-comparison.png` });
  await page.keyboard.press("Escape");
  await comparison.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Close planet properties" }).click();

  await page.getByRole("cell").getByRole("button", { name: "TRAPPIST-1 e", exact: true }).click();
  const missingCard = page.getByTestId("planet-card");
  assert.equal(
    await missingCard.getByRole("button", { name: "Compare with Earth in AR" }).isDisabled(),
    true,
  );
  assert.equal(
    await missingCard.getByTestId("ar-compare-unavailable").innerText(),
    "Radius missing in the archive",
  );
  await page.getByRole("button", { name: "Close planet properties" }).click();
  console.log(
    `ar smoke: planet (${bytes} bytes) and Earth comparison (${comparisonBytes} bytes) built; labels, uncertainty, unsupported-device reason, and missing-radius guard shown`,
  );
}
