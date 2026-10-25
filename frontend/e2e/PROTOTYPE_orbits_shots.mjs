// PROTOTYPE (issue #5): screenshot each System view variant. Needs `pnpm vite --port 5175` running.
// Run: node e2e/PROTOTYPE_orbits_shots.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const outDir = new URL("../../artifacts/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

for (const v of ["A", "B", "C"]) {
  await page.goto(`http://127.0.0.1:5175/?variant=${v}`);
  await page.locator("canvas").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  // Select planet e through the planet label's position is fragile; use the transit list / click canvas centre-right instead.
  await page.screenshot({ path: `${outDir}prototype-orbits-${v}.png` });
}

// Selection + provenance: select planet e, pause time, hover it (C) and hover a value (tooltip).
for (const v of ["B", "C"]) {
  await page.goto(`http://127.0.0.1:5175/?variant=${v}`);
  await page.locator("canvas").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const s = window.__protoStore.getState();
    s.setPlaying(false);
    s.select("TRAPPIST-1 e");
    s.hover("TRAPPIST-1 e");
  });
  await page.waitForTimeout(500);
  await page
    .getByText(/^0\.9200 ± .* R⊕$/)
    .first()
    .hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}prototype-orbits-${v}-selected.png` });
}
writeFileSync(`${outDir}prototype-orbits-console.log`, logs.join("\n") + "\n");
await browser.close();
const errors = logs.filter((l) => l.startsWith("[error]") || l.startsWith("[pageerror]"));
console.log(`shots done, ${logs.length} console lines, ${errors.length} errors`);
if (errors.length) console.log(errors.join("\n"));
