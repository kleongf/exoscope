// MANUAL screenshot check for coloured quantities: real OpenAI + NASA. Needs keys; never run by verify.
// FRONTEND=http://127.0.0.1:5192 node e2e/colour-shots.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.FRONTEND ?? "http://127.0.0.1:5192";
const out = new URL("../../artifacts/colour/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const errors = [];
async function ask(page, q) {
  await page.getByLabel("Or type your question").fill(q);
  await page.getByRole("button", { name: "Send question" }).click();
  await page.getByTestId("turn-status").getByText("Processing", { exact: false }).waitFor();
  await page.getByTestId("turn-status").getByText("Ready", { exact: false }).waitFor();
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(120_000);
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await ask(page, "Open TRAPPIST-1");
  await page.getByRole("button", { name: "Pause" }).click();
  await page
    .getByTestId("system-view")
    .getByRole("button", { name: "TRAPPIST-1 e", exact: true })
    .click();
  await page.getByTestId("planet-card").waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}1-planet-card.png` });
  await page.waitForTimeout(15_000);
  await ask(page, "Compare radius and irradiation");
  await page.getByTestId("compare-workspace").waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}2-compare.png` });
  console.log(`colour-shots: saved to ${out}; ${errors.length} console errors`);
  if (errors.length) console.log(errors.slice(0, 5).join("\n"));
} finally {
  await browser.close();
}
