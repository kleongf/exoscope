// PROTOTYPE (throwaway): screenshots of the #15 Project explorer variants.
// Assumes `pnpm vite --host 127.0.0.1 --port 5181 --strictPort` is running (no backend needed).
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5181/";
const out = new URL("../../artifacts/project-explorer/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const logs = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(10000);
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
const shot = (name) => page.screenshot({ path: `${out}${name}.png` });
const explorer = page.getByRole("complementary", { name: "Project explorer" });

async function open(v) {
  await page.goto(`${base}?variant=${v}`);
  await page.getByTestId("prototype-switcher").waitFor();
  await page.waitForTimeout(600);
}

// A — grouped list: populated, reopen a comparison, dropdown, empty Project.
await open("A");
await shot("A-1-populated");
await explorer.getByRole("button", { name: /Insolation vs Planet radius · TRAPPIST-1/ }).click();
await shot("A-2-reopened");
await explorer.getByRole("button", { name: /TRAPPIST-1 habitability/ }).click();
await page.getByRole("button", { name: /^New Project\s*0 items/ }).waitFor();
await page.waitForTimeout(300);
await shot("A-3-switcher-dropdown");
await page.getByRole("button", { name: /^New Project\s*0 items/ }).click();
await page.waitForTimeout(300);
await shot("A-4-empty");

// B — timeline: populated, filter, Projects home, empty Project.
await open("B");
await shot("B-1-populated");
await explorer.getByRole("button", { name: "Compare", exact: true }).click();
await explorer.getByRole("button", { name: /Compared\s*Insolation vs Planet radius · TOI-700/ }).click();
await shot("B-2-filtered-reopened");
await explorer.getByRole("button", { name: /All Projects/ }).click();
await shot("B-3-projects-home");
await explorer.getByRole("button", { name: /^New Project\s*Empty/ }).click();
await page.waitForTimeout(300);
await shot("B-4-empty");

// C — board: populated, reopen a Sample card, empty Project tab.
await open("C");
await shot("C-1-populated");
await explorer.getByRole("button", { name: /Small planets with short periods/ }).click();
await shot("C-2-reopened");
await explorer.getByRole("tab", { name: "New Project" }).click();
await page.waitForTimeout(300);
await shot("C-3-empty");

// Arrow keys cycle variants.
await open("A");
await page.keyboard.press("ArrowRight");
const label = await page.getByTestId("prototype-switcher").innerText();
if (!label.includes("B")) throw new Error(`ArrowRight did not cycle: ${label}`);

writeFileSync(`${out}console.log`, logs.join("\n"));
await browser.close();
console.log(`shots in ${out}; ${logs.filter((l) => /error/i.test(l)).length} console error lines`);
