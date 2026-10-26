// MANUAL live check for #8: real OpenAI + NASA archive. Needs keys in .env; never run by verify.
// Start the backend and a dev server first, e.g.
//   (cd backend && uv run uvicorn exoscope.app:app --port 8020)
//   (cd frontend && EXOSCOPE_API=http://127.0.0.1:8020 pnpm vite --host 127.0.0.1 --port 5178)
// then: FRONTEND=http://127.0.0.1:5178 node e2e/compare-live.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.FRONTEND ?? "http://127.0.0.1:5178";
const outDir = new URL("../../artifacts/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const errors = [];

async function ask(page, question) {
  const started = Date.now();
  await page.getByLabel("Or type your question").fill(question);
  await page.getByRole("button", { name: "Send question" }).click();
  await page.getByTestId("turn-status").getByText("Processing", { exact: false }).waitFor();
  await page.getByTestId("turn-status").getByText("Ready", { exact: false }).waitFor();
  return (Date.now() - started) / 1000;
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(90_000);
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);

  const open = await ask(page, "Open TRAPPIST-1");
  await page.locator("canvas").first().waitFor();
  const compared = await ask(page, "Compare radius and irradiation");
  await page.getByTestId("compare-workspace").waitFor();
  const counts = await page.getByTestId("compare-counts").textContent();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}compare-live-1-compared.png` });

  // Click e's marker in the chart: linked selection should reach the table and the System view.
  const point = page.locator(".scatterlayer .point").nth(3);
  await point.click({ force: true });
  const row = page.locator('[data-planet="TRAPPIST-1 e"]');
  assert.equal(await row.getAttribute("data-state"), "selected");
  await page.getByTestId("planet-card").getByText("TRAPPIST-1 e", { exact: true }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}compare-live-2-selected.png` });

  const items = await page.getByTestId("comparison-item").count();
  console.log(
    `compare-live: open ${open.toFixed(1)}s, compare ${compared.toFixed(1)}s, ` +
      `${counts?.trim()}, ${items} comparison(s) in explorer, ${errors.length} console errors`,
  );
  if (errors.length) console.log(errors.join("\n"));
} finally {
  await browser.close();
}
