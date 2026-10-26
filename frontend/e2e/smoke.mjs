// Launch-and-look check. Voice uses explicit browser fixtures, never live provider calls.
// Assumes backend on :8000 and frontend on :5173 (scripts/verify starts both);
// EXO_API_URL / EXO_WEB_URL override them.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { exerciseVoice } from "./voice-smoke.mjs";
import { exerciseLayout } from "./layout-smoke.mjs";
import { exerciseAr } from "./ar-smoke.mjs";
import { exerciseWeb } from "./web-smoke.mjs";
import { validateTurnFixtures } from "./validate-fixtures.mjs";
import { exerciseProjects } from "./project-smoke.mjs";
import { exerciseReports } from "./report-smoke.mjs";

validateTurnFixtures();

const outDir = new URL("../../artifacts/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const API_URL = process.env.EXO_API_URL ?? "http://127.0.0.1:8000";
const health = await fetch(`${API_URL}/health`, {
  signal: AbortSignal.timeout(15000),
}).then((r) => r.json());
if (health.status !== "ok") throw new Error(`backend /health: ${JSON.stringify(health)}`);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const logs = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  await exerciseVoice(page);
  await page.locator("canvas").first().waitFor();
  await page.waitForTimeout(1000);
  await exerciseLayout(page);
  await exerciseWeb(page);
  await page.screenshot({ path: `${outDir}smoke.png` });
  await exerciseAr(page, outDir);
  await exerciseProjects(browser, outDir);
  await exerciseReports(page, outDir);
  const errors = logs.filter(
    (line) => line.startsWith("[error]") || line.startsWith("[pageerror]"),
  );
  console.log(
    `smoke: screenshot artifacts/smoke.png, ${logs.length} console lines, ${errors.length} errors`,
  );
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  writeFileSync(`${outDir}console.log`, logs.join("\n") + "\n");
  await browser.close();
}
