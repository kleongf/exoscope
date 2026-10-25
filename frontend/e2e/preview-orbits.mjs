// Screenshots of the dev-only orbit preview (/?preview=orbits): default, planet selected with a
// source tooltip open, a planet hover card, and true sizes. Assumes the dev server is running; pass its URL as argv[2].
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:5173";
const outDir = new URL("../../artifacts/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

async function open(query) {
  await page.goto(`${base}/?preview=orbits${query}`);
  await page.locator("canvas").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
}

await open("");
await page.screenshot({ path: `${outDir}orbits-default.png` });

await open(`&planet=${encodeURIComponent("TRAPPIST-1 e")}`);
await page.getByTestId("planet-card").getByText("Semi-major axis").hover();
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}orbits-selected.png` });

// Pause, then sweep the pointer over the scene until a planet's provenance card appears.
await open("");
await page.getByRole("button", { name: "Pause" }).click();
const card = page.getByText("orbits since that epoch");
let hovered = false;
for (let y = 260; y < 880 && !hovered; y += 12) {
  for (let x = 200; x < 1240 && !hovered; x += 12) {
    await page.mouse.move(x, y);
    hovered = await card.isVisible();
  }
}
await page.screenshot({ path: `${outDir}orbits-hover.png` });
if (!hovered) logs.push("[error] no planet hover card found");

await open("");
await page.getByRole("switch", { name: "True sizes" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}orbits-true-sizes.png` });

writeFileSync(`${outDir}orbits-console.log`, logs.join("\n") + "\n");
await browser.close();

const errors = logs.filter((l) => l.startsWith("[error]") || l.startsWith("[pageerror]"));
console.log(`orbits preview: 4 screenshots, ${logs.length} console lines, ${errors.length} errors`);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
