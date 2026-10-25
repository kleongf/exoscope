// Launch-and-look check: loads the app, checks the backend, saves a screenshot and console log.
// Assumes backend on :8000 and frontend on :5173 (scripts/verify starts both).
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const outDir = new URL("../../artifacts/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const health = await fetch("http://127.0.0.1:8000/health").then((r) => r.json());
if (health.status !== "ok") throw new Error(`backend /health: ${JSON.stringify(health)}`);

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto("http://127.0.0.1:5173/");
await page.locator("canvas").first().waitFor({ timeout: 15000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}smoke.png` });
writeFileSync(`${outDir}console.log`, logs.join("\n") + "\n");
await browser.close();

const errors = logs.filter((l) => l.startsWith("[error]") || l.startsWith("[pageerror]"));
console.log(
  `smoke: screenshot artifacts/smoke.png, ${logs.length} console lines, ${errors.length} errors`,
);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
