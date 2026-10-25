// MANUAL live check for #9: real Gemma + NASA archive. Needs keys in .env; never run by verify.
// Start the backend and a dev server first, e.g.
//   (cd backend && uv run uvicorn exoscope.app:app --port 8040)
//   (cd frontend && EXOSCOPE_API=http://127.0.0.1:8040 pnpm vite --host 127.0.0.1 --port 5180)
// then: FRONTEND=http://127.0.0.1:5180 node e2e/search-live.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.FRONTEND ?? "http://127.0.0.1:5180";
const outDir = new URL("../../artifacts/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const errors = [];

async function settle(page, started) {
  await page.getByTestId("turn-status").getByText("Processing", { exact: false }).waitFor();
  await page.getByTestId("turn-status").getByText("Ready", { exact: false }).waitFor();
  return (Date.now() - started) / 1000;
}

async function ask(page, question) {
  const started = Date.now();
  await page.getByLabel("Or type your question").fill(question);
  await page.getByRole("button", { name: "Send question" }).click();
  return settle(page, started);
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(90_000);
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);

  const searched = await ask(page, "Find small planets with periods under 10 days");
  await page.getByTestId("sample-workspace").waitFor();
  const chips1 = await page.getByTestId("interpretation-chip").allTextContents();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}search-live-1-sample.png` });

  // Edit the first Interpretation chip: re-runs the search as an explicit turn.
  await page.getByTestId("interpretation-chip").first().click();
  const input = page.getByLabel(/^New reading for/);
  await input.fill("radius < 1.5 Earth radii");
  const started = Date.now();
  await page.getByRole("button", { name: "Search again" }).click();
  const edited = await settle(page, started);
  const chips2 = await page.getByTestId("interpretation-chip").allTextContents();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}search-live-2-edited-chip.png` });

  // Click a Sample planet from a System not yet in the Project: it opens live and is selected.
  const row = page.getByTestId("sample-workspace").locator("tr[data-planet]").first();
  const planet = await row.getAttribute("data-planet");
  const opening = Date.now();
  await row.click();
  const opened = await settle(page, opening);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}search-live-3-other-system.png` });
  const viewTitle =
    (await page.getByText("System view", { exact: true }).locator("..").textContent()) ?? "";

  console.log(
    JSON.stringify(
      {
        searchSeconds: searched,
        chipsBefore: chips1,
        editSeconds: edited,
        chipsAfter: chips2,
        clickedPlanet: planet,
        openSeconds: opened,
        systemView: viewTitle.replace("System view", "").trim(),
        samples: await page.getByTestId("sample-item").count(),
        consoleErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
