import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seedReportProject, advanceReportProject } from "./report-fixtures.mjs";
import {
  assertDownloadedReport,
  assertInteractiveChart,
  assertSceneCapture,
  getReportBytes,
  readEvidence,
  withOfflineReport,
} from "./report-offline.mjs";

async function loadProject(page, id) {
  const response = await page.request.get(new URL(`/api/projects/${id}`, page.url()).href);
  assert(response.ok(), `Project GET failed: ${response.status()}`);
  return response.json();
}

async function setScope(page, name, selected) {
  const button = page.getByRole("button", { name, exact: true });
  if ((await button.getAttribute("aria-pressed")) !== String(selected)) await button.click();
  assert.equal(await button.getAttribute("aria-pressed"), String(selected));
}

function metadataOnly(project) {
  for (const report of project.reports) {
    assert.deepEqual(Object.keys(report).sort(), [
      "file",
      "id",
      "includes",
      "request",
      "title",
      "written_at",
    ]);
    assert.match(report.file, /^[a-zA-Z0-9-]+\.html$/);
    assert.equal(typeof report.request, "string");
  }
  assert(!JSON.stringify(project).includes("<!doctype"));
  assert(!JSON.stringify(project).includes("data:image/png"));
}

async function exportReport(page, projectId, title, include) {
  await page.getByLabel("Report title", { exact: true }).fill(title);
  const [request] = await Promise.all([
    page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === `/api/projects/${projectId}/reports` &&
        request.method() === "POST",
    ),
    page.getByRole("button", { name: "Save HTML Report", exact: true }).click(),
  ]);
  const body = request.postDataJSON();
  assert(
    Object.keys(body).every((key) =>
      ["title", "include", "summary", "limitations", "snapshot"].includes(key),
    ),
  );
  assert.equal(body.title, title);
  assert.deepEqual(body.include, include);
  for (const name of Object.keys(request.headers()))
    assert(!/authorization|api[-_]?key/i.test(name));
  const response = await request.response();
  assert(response?.ok(), `Report POST failed: ${response?.status()}`);
  const project = await response.json();
  assert.equal(project.id, projectId);
  await page.getByRole("link", { name: `Open Report ${title}`, exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Write Report", exact: true })
    .waitFor({ state: "visible" });
  const report = project.reports.find((report) => report.title === title);
  assert(report);
  assert.deepEqual(report.includes, Object.values(include).flat());
  metadataOnly(project);
  assert.deepEqual((await loadProject(page, projectId)).reports, project.reports);
  return { project, report, snapshot: body.snapshot };
}

async function assertScientificPaper(page, sources) {
  for (const heading of [
    "Summary",
    "Data and method",
    "Results",
    "Interpretations",
    "Limitations",
    "References · source papers",
    "Web sources",
    "Appendix: tool-call log",
  ])
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  const text = await page.locator("body").innerText();
  assert(!text.includes("TOI-700"), "Report must not expand to all saved Systems");
  for (const value of [
    "Earth radii",
    "Earth flux",
    "lower -0.012 / upper +0.014",
    "Missing (Earth radii)",
    "Cached · Snapshot 2026-10-25",
    "radius under 2 Earth radii",
    "Size alone establishes no habitability",
    "pscomppars",
    "may not be mutually consistent",
    "not an N-body",
    "1 plotted; 1 excluded",
    "12.5 ms",
  ])
    assert(text.includes(value), `Report should explain ${value}`);
  assert((await page.locator("table").count()) >= 4);
  assert(
    !(await page.locator("table").allInnerTexts()).join("\n").includes("987.65"),
    "Web prose must never supply archive table measurements",
  );
  await page.getByRole("link", { name: "Agol et al. 2021", exact: true }).first().waitFor();
  for (const source of sources)
    assert.equal(
      await page.getByRole("link", { name: source.title, exact: true }).getAttribute("href"),
      source.url,
    );
  const printStyle = await page.locator("style").allTextContents();
  assert(
    printStyle.some((css) => /@media\s+print/.test(css)),
    "Report needs print CSS",
  );
  await page.emulateMedia({ media: "print" });
  await page.getByRole("heading", { name: "Results", exact: true }).waitFor();
  await page.emulateMedia({ media: "screen" });
}

export async function exerciseReports(page, outDir) {
  const dir = process.env.EXOSCOPE_PROJECTS_DIR;
  if (!dir) {
    console.log("Report smoke: skipped (EXOSCOPE_PROJECTS_DIR not set)");
    return;
  }
  const fixture = seedReportProject(dir);
  // Earlier browser beats leave /turn mocks on this page. Reports use real HTTP endpoints.
  await page.unroute("**/api/turn");
  await page.reload();
  const switcher = page.getByTestId("project-switcher");
  await switcher.filter({ hasNotText: "No Project open" }).waitFor();
  await switcher.click();
  await page.getByTestId("project-option").filter({ hasText: fixture.name }).click();
  await switcher.getByText(fixture.name, { exact: true }).waitFor();
  await page
    .locator("#system-heading")
    .filter({ hasText: /^TRAPPIST-1$/ })
    .waitFor();
  await page.getByTestId("system-view").locator("canvas").waitFor();
  await page.waitForTimeout(1000);
  const initial = await loadProject(page, fixture.id);
  assert.match(initial.id, /^p-[a-f0-9]{8}$/);
  assert.equal(initial.current_system, "TRAPPIST-1");
  const trappist = initial.systems.find((item) => item.system.hostname === "TRAPPIST-1");
  const toi = initial.systems.find((item) => item.system.hostname === "TOI-700");
  const comparison = initial.comparisons[0];
  const sample = initial.samples[0];
  const sources = initial.web_sources;
  assert(sources.length >= 2);
  const firstTitle = "TRAPPIST-1 radius evidence";
  const secondTitle = "TOI-700 saved evidence";
  const firstInclude = {
    systems: [trappist.id],
    comparisons: [comparison.id],
    samples: [sample.id],
    web_sources: sources.map((source) => source.id),
  };
  const draft = "Unsent question stays while writing Reports";
  await page.getByLabel("Or type your question").fill(draft);
  const turnsBefore = await page.getByTestId("conversation-turn").count();
  await page.getByRole("button", { name: "Write Report", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", {
        name: "Include System TRAPPIST-1",
        exact: true,
      })
      .getAttribute("aria-pressed"),
    "true",
  );
  await setScope(page, "Include System TOI-700", false);
  await setScope(page, `Include comparison ${comparison.id}`, true);
  await setScope(page, `Include Sample ${sample.id}`, true);
  for (const source of sources) await setScope(page, `Include Web source ${source.title}`, true);
  const first = await exportReport(page, initial.id, firstTitle, firstInclude);
  assert.equal(await page.getByLabel("Or type your question").inputValue(), draft);
  assert.equal(await page.getByTestId("conversation-turn").count(), turnsBefore);
  const firstBytes = await getReportBytes(page, first.report);
  const expected = {
    systems: [trappist],
    comparisons: [comparison],
    samples: [sample],
    web_sources: sources,
    included: first.report.includes,
  };
  await withOfflineReport(page, firstTitle, async (report) => {
    assert.deepEqual(await readEvidence(report), expected);
    await assertScientificPaper(report, sources);
    await assertInteractiveChart(report);
    await assertSceneCapture(report, first.snapshot);
    await report.screenshot({ path: `${outDir}report-first.png`, fullPage: true });
  });
  await assertDownloadedReport(page, first.report, firstBytes, expected, outDir);

  await page.getByRole("button", { name: "Write Report", exact: true }).click();
  // Reopening resets scope to the current System, rather than retaining the first Report.
  for (const name of [`Include comparison ${comparison.id}`, `Include Sample ${sample.id}`])
    assert.equal(
      await page.getByRole("button", { name, exact: true }).getAttribute("aria-pressed"),
      "false",
    );
  await setScope(page, "Include System TRAPPIST-1", false);
  await setScope(page, "Include System TOI-700", true);
  for (const source of sources) await setScope(page, `Include Web source ${source.title}`, false);
  const second = await exportReport(page, initial.id, secondTitle, {
    systems: [toi.id],
    comparisons: [],
    samples: [],
    web_sources: [],
  });
  const secondBytes = await getReportBytes(page, second.report);
  assert.equal(await page.getByLabel("Or type your question").inputValue(), draft);
  assert.equal(await page.getByTestId("conversation-turn").count(), turnsBefore);
  await withOfflineReport(page, secondTitle, async (report) => {
    assert.deepEqual(await readEvidence(report), {
      systems: [toi],
      comparisons: [],
      samples: [],
      web_sources: [],
      included: [toi.id],
    });
    assert(!(await report.locator("body").innerText()).includes("TRAPPIST-1"));
    assert.equal(await report.locator(".js-plotly-plot").count(), 0);
    assert.equal(await report.getByRole("img", { name: "Saved System view" }).count(), 0);
    await report
      .getByText("System view snapshot unavailable for the selected evidence.", {
        exact: true,
      })
      .waitFor();
  });
  assert.deepEqual(await getReportBytes(page, first.report), firstBytes);

  // Re-record changed source evidence using the canonical persistence path, then reload it.
  const later = advanceReportProject(dir, initial.id);
  assert.equal(
    later.systems.find((item) => item.id === trappist.id).system.planets[0].radius.value,
    9.99,
  );
  assert.deepEqual(later.reports, [first.report, second.report]);
  await page.reload();
  for (const title of [firstTitle, secondTitle])
    await page.getByRole("link", { name: `Open Report ${title}`, exact: true }).waitFor();
  const reloaded = await loadProject(page, initial.id);
  assert.deepEqual(reloaded, later);
  metadataOnly(JSON.parse(readFileSync(`${dir}/${initial.id}.json`, "utf8")));
  assert.deepEqual(await getReportBytes(page, first.report), firstBytes);
  assert.deepEqual(await getReportBytes(page, second.report), secondBytes);
  await withOfflineReport(page, firstTitle, async (report) => {
    assert.deepEqual(await readEvidence(report), expected);
    await assertInteractiveChart(report);
  });
  console.log(
    "Reports smoke: canonical scopes, actual PNG, offline Plotly/download, metadata-only Projects and immutable HTML survived a second export, changed source evidence and backend reload; no provider calls",
  );
}
