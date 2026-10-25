// Exercises the DEV compare preview: chart + table render, clicking a point selects the
// planet and highlights its table row, and a simulated missing value is excluded.
// Usage: start `pnpm dev` (or vite on another port), then `node e2e/compare-preview.mjs [baseUrl]`.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:5173";
const out = new URL("../../artifacts/", import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));

await page.goto(`${base}/?preview=compare`);
await page.getByTestId("compare-chart").locator(".scatterlayer .point").first().waitFor();

const counts = await page.getByTestId("compare-counts").textContent();
if (!counts?.startsWith("7 plotted · 0 excluded")) throw new Error(`counts: ${counts}`);

// Plotly hit-tests on its drag layer, so click at the point's position.
const point = page.getByTestId("compare-chart").locator(".scatterlayer .point").nth(3);
const box = await point.boundingBox();
if (!box) throw new Error("no point box");
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
const selected = await page.getByTestId("selected-planet").textContent();
const row = page.locator('tr[data-state="selected"]');
const rowPlanet = await row.getAttribute("data-planet");
if (!selected?.includes("TRAPPIST-1 e") || rowPlanet !== "TRAPPIST-1 e") {
  throw new Error(`selection: header=${selected} row=${rowPlanet}`);
}
await page.screenshot({ path: fileURLToPath(new URL("compare-preview.png", out)) });

await page.getByLabel("Simulate a missing radius for TRAPPIST-1 d").check();
const after = await page.getByTestId("compare-counts").textContent();
const dRow = await page.locator('tr[data-planet="TRAPPIST-1 d"]').textContent();
if (!after?.startsWith("6 plotted · 1 excluded") || !dRow?.includes("missing")) {
  throw new Error(`missing path: counts=${after} row=${dRow}`);
}
await page.screenshot({ path: fileURLToPath(new URL("compare-preview-missing.png", out)) });

writeFileSync(new URL("compare-preview-console.log", out), logs.join("\n"));
await browser.close();
const errors = logs.filter((l) => l.startsWith("error") || l.startsWith("pageerror"));
console.log(`compare preview: ok, ${logs.length} console lines, ${errors.length} errors`);
if (errors.length) process.exit(1);
