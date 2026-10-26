// MANUAL dry run of the demo video script: real Gemma, NASA and xAI. Needs keys; never run by verify.
// Start backend (:8060) and `EXOSCOPE_API=http://127.0.0.1:8060 pnpm vite --port 5190`, then
// FRONTEND=http://127.0.0.1:5190 OUT=/tmp/dryrun node e2e/demo-dryrun.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.FRONTEND ?? "http://127.0.0.1:5190";
const out = process.env.OUT ?? new URL("../../artifacts/dryrun/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const beats = [
  "Open TRAPPIST-1",
  "Focus on planet e and speed up time",
  "Compare radius and irradiation",
  "Does any of these planets have liquid water?",
  "Find small planets with periods under 10 days",
  "Write a report on the radius comparison",
];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(120_000);
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  for (const [i, q] of beats.entries()) {
    if (i) await page.waitForTimeout(15_000); // stay under Gemma's 16k tokens/min
    const t = Date.now();
    await page.getByLabel("Or type your question").fill(q);
    await page.getByRole("button", { name: "Send question" }).click();
    await page.getByTestId("turn-status").getByText("Processing", { exact: false }).waitFor();
    await page.getByTestId("turn-status").getByText("Ready", { exact: false }).waitFor();
    const secs = ((Date.now() - t) / 1000).toFixed(1);
    await page.waitForTimeout(1500);
    const turn = page.getByTestId("conversation-turn").last();
    const text = (await turn.innerText()).replace(/\s+/g, " ").slice(0, 260);
    await page.screenshot({ path: `${out}/beat-${i + 1}.png` });
    console.log(`beat ${i + 1} (${secs}s) ${q}\n   ${text}`);
  }
  console.log(`console errors: ${errors.length}`);
  if (errors.length) console.log(errors.slice(0, 5).join("\n"));
} finally {
  await browser.close();
}
