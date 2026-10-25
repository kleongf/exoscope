// PROTOTYPE (prototype/turn-ui): screenshot each variant mid-turn, after success, after failure.
// Run: node e2e/PROTOTYPE-turn-ui.mjs   (dev server on 127.0.0.1:5174)
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:5174/";
const OUT = new URL("../../artifacts/turn-ui/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

for (const v of ["A", "B", "C"]) {
  await page.goto(`${BASE}?variant=${v}`);
  await page.getByRole("button", { name: "Open TRAPPIST-1" }).click();
  await page.waitForTimeout(3600); // mid-turn: inside load_system
  await page.screenshot({ path: `${OUT}${v}-1-in-progress.png` });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}${v}-2-live-success.png` });
  await page.getByRole("button", { name: "Open Planet Nonexistent" }).click();
  await page.waitForTimeout(6800);
  await page.screenshot({ path: `${OUT}${v}-3-failure.png` });
  await page.getByLabel("Simulate NASA outage").check();
  await page.getByRole("button", { name: "Open TRAPPIST-1" }).click();
  await page.waitForTimeout(10800);
  await page.screenshot({ path: `${OUT}${v}-4-cached.png` });
}
await browser.close();
console.log(`screenshots in ${OUT}; console errors: ${errors.length}`);
for (const e of errors) console.log("  ", e);
