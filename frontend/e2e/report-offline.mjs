import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export async function readEvidence(page) {
  return JSON.parse(await page.locator("#saved-evidence").textContent());
}

async function assertSelfContained(page, title) {
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  assert.equal(await page.title(), title);
  assert.equal(
    await page.locator("script[src], link[rel=stylesheet], iframe, object, embed").count(),
    0,
    "Report must embed its runtime and styles",
  );
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => entry.name),
  );
  assert.deepEqual(
    resources.filter((url) => /^https?:/.test(url)),
    [],
  );
  for (const image of await page.locator("img").all())
    assert.match(await image.getAttribute("src"), /^data:image\//);
}

export async function assertInteractiveChart(page) {
  const plot = page.locator(".js-plotly-plot").first();
  await plot.locator(".main-svg").first().waitFor();
  const before = await plot.evaluate((node) => ({
    id: node.id,
    range: [...node._fullLayout.xaxis.range],
    points: node.data[0].x,
    errors: node.data[0].error_x,
  }));
  assert.deepEqual(before.points, [1.116], "Only saved archive measurements are plotted");
  assert.deepEqual(before.errors.array, [0.014]);
  assert.deepEqual(before.errors.arrayminus, [0.012]);
  await plot.scrollIntoViewIfNeeded();
  const bounds = await plot.locator(".nsewdrag").boundingBox();
  assert(bounds);
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.8, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForFunction(
    ({ id, range }) =>
      JSON.stringify(document.getElementById(id)._fullLayout.xaxis.range) !== JSON.stringify(range),
    before,
  );
}

export async function assertSceneCapture(page, snapshot) {
  assert(snapshot, "Report POST must carry the actual canvas capture");
  const image = page.getByRole("img", { name: "Saved System view", exact: true });
  await image.waitFor();
  assert.equal(await image.getAttribute("src"), snapshot.data_url);
  assert.equal(snapshot.hostname, "TRAPPIST-1");
  assert(Number.isFinite(Date.parse(snapshot.captured_at)));
  const pixels = await image.evaluate(async (img) => {
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    context.drawImage(img, 0, 0, 64, 64);
    const data = context.getImageData(0, 0, 64, 64).data;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 3]) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return { width: img.naturalWidth, height: img.naturalHeight, colors: colors.size };
  });
  assert(pixels.width > 100 && pixels.height > 100);
  assert(pixels.colors > 2, "Canvas capture must contain a rendered scene");
}

function recordErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
}

// Fetch the real HTTP Report online first; then exercise its embedded runtime offline.
export async function withOfflineReport(page, title, check) {
  const context = page.context();
  const requests = [];
  const errors = [];
  const link = page.getByRole("link", { name: `Open Report ${title}`, exact: true });
  assert.equal(await link.getAttribute("target"), "_blank");
  const url = new URL(await link.getAttribute("href"), page.url()).href;
  assert.match(new URL(url).pathname, /^\/api\/reports\/[^/]+\.html$/);
  const record = (request) => {
    if (/^https?:/.test(request.url())) requests.push(request);
  };
  const opened = (popup) => recordErrors(popup, errors);
  context.on("request", record);
  context.on("page", opened);
  let popup;
  try {
    [popup] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await popup.waitForLoadState("load");
    await context.setOffline(true);
    await assertSelfContained(popup, title);
    await check(popup);
    assert.equal(requests.length, 1, "Only the initial Report navigation may use HTTP");
    assert.equal(requests[0].url(), url);
    assert(requests[0].isNavigationRequest());
    assert.deepEqual(errors, [], "Offline Report must execute without browser errors");
  } finally {
    await popup?.close();
    await context.setOffline(false);
    context.off("request", record);
    context.off("page", opened);
  }
}

export async function getReportBytes(page, report) {
  const response = await page.request.get(new URL(`/api/reports/${report.file}`, page.url()).href);
  assert(response.ok(), `Report GET failed: ${response.status()}`);
  assert.match(response.headers()["content-type"], /^text\/html/);
  assert(!/attachment/i.test(response.headers()["content-disposition"] ?? ""));
  return response.body();
}

export async function assertDownloadedReport(page, report, bytes, expected, outDir) {
  const link = page.getByRole("link", { name: `Download Report ${report.title}`, exact: true });
  assert.notEqual(await link.getAttribute("download"), null);
  assert.equal(
    new URL(await link.getAttribute("href"), page.url()).pathname,
    `/api/reports/${report.file}`,
  );
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  assert.match(download.suggestedFilename(), /\.html$/);
  const path = `${outDir}${report.file}`;
  await download.saveAs(path);
  assert.deepEqual(readFileSync(path), bytes, "Downloaded HTML must match the immutable GET bytes");
  const context = await page.context().browser().newContext({ offline: true });
  const requests = [];
  const errors = [];
  context.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  try {
    const file = await context.newPage();
    recordErrors(file, errors);
    await file.goto(pathToFileURL(path).href);
    await assertSelfContained(file, report.title);
    assert.deepEqual(await readEvidence(file), expected);
    await assertInteractiveChart(file);
    assert.deepEqual(requests, [], "Downloaded HTML must not fetch assets");
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
