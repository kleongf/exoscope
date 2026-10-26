// LIVE check, not part of verify: real OpenAI + NASA through /turn. Needs keys in .env.
// Usage: EXO_WEB_URL=http://127.0.0.1:5179 node e2e/live-scene-control.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const WEB_URL = process.env.EXO_WEB_URL ?? "http://127.0.0.1:5173";
const outDir = new URL("../../artifacts/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${WEB_URL}/`);
  // Each turn sends the System as context; space turns out to stay well under rate limits.
  const pause = Number(process.env.EXO_TURN_GAP_MS ?? 65000);
  let first = true;
  const ask = async (text, shot) => {
    if (!first) await page.waitForTimeout(pause);
    first = false;
    const turns = await page.getByTestId("conversation-turn").count();
    const started = Date.now();
    await page.getByLabel("Or type your question").fill(text);
    await page.getByRole("button", { name: "Send question" }).click();
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="conversation-turn"]').length > n,
      turns,
    );
    await page.getByTestId("turn-status").filter({ hasText: "Ready" }).waitFor();
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    await page.waitForTimeout(2500); // let the camera glide settle
    await page.screenshot({ path: `${outDir}${shot}.png` });
    const turn = page.getByTestId("conversation-turn").last();
    const reply = (await turn.innerText()).replace(/\s+/g, " ");
    console.log(`${text} → ${seconds}s | ${reply.slice(0, 220)}`);
    return reply;
  };
  await ask("Open TRAPPIST-1", "scene-1-open");
  await page.getByTestId("orbit-scene").waitFor();
  await ask("Focus on planet e and speed up time", "scene-2-focus-speed");
  await ask("Colour the planets by insolation", "scene-3-color-insolation");
  await page.getByTestId("color-legend").waitFor();
  const rejected = await ask("Focus on planet z", "scene-4-reject-z");
  assert(
    /no planet|doesn.t have|not .*planet|isn.t/i.test(rejected),
    "z must be rejected honestly",
  );
  assert.equal(errors.length, 0, errors.join("\n"));
} finally {
  await browser.close();
}
