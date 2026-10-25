// Projects: reopen on load, New Project starts empty, switch back restores, a damaged file is
// shown with its error, and a reload keeps the open Project. Seeds files in EXOSCOPE_PROJECTS_DIR
// (scripts/verify points backend and smoke at artifacts/projects).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const WEB_URL = process.env.EXO_WEB_URL ?? "http://127.0.0.1:5173";
const system = JSON.parse(
  readFileSync(new URL("../src/test/trappist-1.json", import.meta.url), "utf8"),
);

function seed(dir) {
  mkdirSync(dir, { recursive: true });
  const at = new Date().toISOString();
  const turn = {
    id: "turn-1",
    at,
    transcript: "Open TRAPPIST-1",
    reply_text: "Loaded.",
    steps: [],
  };
  const project = {
    format: "exoscope.project",
    version: 1,
    id: "p-5e0e0001",
    name: "Smoke: rocky worlds",
    created_at: at,
    updated_at: at,
    current_system: "TRAPPIST-1",
    next_seq: 3,
    turns: [turn],
    systems: [{ id: "sys-2", turn_id: "turn-1", opened_at: at, system }],
  };
  writeFileSync(`${dir}/p-5e0e0001.json`, JSON.stringify(project));
  writeFileSync(`${dir}/p-5e0ebad0.json`, "{ damaged");
}

function check(ok, message) {
  if (!ok) throw new Error(`project smoke: ${message}`);
}

export async function exerciseProjects(browser, outDir) {
  const dir = process.env.EXOSCOPE_PROJECTS_DIR;
  if (!dir) {
    console.log("project smoke: skipped (EXOSCOPE_PROJECTS_DIR not set)");
    return;
  }
  seed(dir);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const switcher = page.getByTestId("project-switcher");
  const systems = page.getByTestId("system-item");
  await page.goto(`${WEB_URL}/`);
  await switcher.getByText("Smoke: rocky worlds").waitFor();
  await systems.getByText("TRAPPIST-1").waitFor();
  check((await page.getByText("Open TRAPPIST-1").count()) > 0, "chat history not restored");

  await switcher.click();
  const damaged = page.getByTestId("project-option").filter({ hasText: "damaged" });
  await damaged.waitFor();
  check(await damaged.isDisabled(), "damaged Project can be chosen");
  await page.getByTestId("new-project").click();
  await switcher.getByText("New Project").waitFor();
  check((await systems.count()) === 0, "New Project is not empty");

  await switcher.click();
  await page.getByTestId("project-option").filter({ hasText: "Smoke: rocky worlds" }).click();
  await systems.getByText("TRAPPIST-1").waitFor();
  await page.reload();
  await switcher.getByText("Smoke: rocky worlds").waitFor();
  await systems.getByText("TRAPPIST-1").waitFor();
  await page.locator("canvas").first().waitFor();
  await page.waitForTimeout(1000);
  await switcher.click();
  await page.getByTestId("new-project").waitFor();
  await page.waitForTimeout(400); // let the menu finish fading in
  await page.screenshot({ path: `${outDir}projects.png` });
  await page.close();
  console.log("project smoke: reopen, new, switch back, damaged file and reload all OK");
}
