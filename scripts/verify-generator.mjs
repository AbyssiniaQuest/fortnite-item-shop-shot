import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const root = path.resolve("out");
const output = path.resolve(".test-output");
const base = "/fortnite-item-shop-shot";
const payload = JSON.parse(
  await readFile(path.join(root, "shop-data.json"), "utf8"),
);
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const server = createServer(async (request, response) => {
  try {
    let pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname.startsWith(base)) pathname = pathname.slice(base.length);
    if (pathname.endsWith("/") || !pathname) pathname += "index.html";
    const file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
    const data = await readFile(file);
    response.writeHead(200, {
      "content-type": mime[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "public, max-age=3600",
    });
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
await mkdir(output, { recursive: true });
const url =
  process.env.GENERATOR_TEST_URL ??
  `http://127.0.0.1:${server.address().port}${base}/`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let dataRequests = 0;
page.on("request", (request) => {
  if (request.url().endsWith("/shop-data.json")) dataRequests++;
});
await page.addInitScript(() => {
  window.exportDraws = 0;
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    if (args[0] instanceof HTMLImageElement) {
      if (!args[0].complete || !args[0].naturalWidth)
        throw new Error("Undecoded export image");
      window.exportDraws++;
    }
    return draw.apply(this, args);
  };
});

async function downloadAndCheck(
  name,
  button = page.getByTestId("download-pngs"),
) {
  const promise = page.waitForEvent("download", { timeout: 120_000 });
  await button.click();
  const download = await promise;
  const file = path.join(output, name);
  await download.saveAs(file);
  const metadata = await sharp(file).metadata();
  assert.equal(metadata.format, "png");
  assert.ok(metadata.width >= 720 && metadata.height > 100);
  const stats = await sharp(file).stats();
  assert.ok(
    stats.channels.some((channel) => channel.stdev > 30),
    "PNG is blank",
  );
  console.log(
    `${name}: ${metadata.width} x ${metadata.height}, ${Math.round((await stat(file)).size / 1024)} KB`,
  );
  return metadata;
}

try {
  await page.goto(url);
  await page.locator(".shop-card").first().waitFor();
  await page
    .locator(".shop-card img")
    .first()
    .evaluate((img) => img.decode());
  assert.equal(
    await page.getByLabel("Columns", { exact: true }).inputValue(),
    "6",
  );
  const skins = await page.locator(".shop-card").count();
  const t0 = Date.now();
  await downloadAndCheck("skins.png");
  assert.equal(await page.evaluate(() => window.exportDraws), skins);
  console.log(
    `All ${skins} skin images decoded and drawn in ${Date.now() - t0} ms.`,
  );
  await page.screenshot({ path: path.join(output, "desktop.png") });
  await page.reload();
  await page.locator(".shop-card").first().waitFor();
  assert.equal(
    dataRequests,
    1,
    "A fresh daily shop was fetched again on reload",
  );
  await page.getByTestId("category-select").click();
  await page.getByRole("button", { name: "Mark all", exact: true }).click();
  const allItems = await page.locator(".shop-card").count();
  assert.equal(allItems, payload.items.length);
  await page.getByRole("heading", { level: 1 }).click();
  await downloadAndCheck("whole-shop.png");
  assert.equal(await page.evaluate(() => window.exportDraws), allItems);
  await page.getByTestId("category-select").click();
  await page.getByRole("button", { name: "Unmark all", exact: true }).click();
  assert.equal(await page.locator(".shop-card").count(), 0);
  await page.getByTestId("category-check-skins").check();
  await page.getByTestId("category-check-pickaxes").check();
  await page.getByRole("heading", { level: 1 }).click();
  assert.equal(await page.locator(".category-menu").count(), 0);
  const mixedItems = await page.locator(".shop-card").count();
  await page.getByLabel("Split export").selectOption("3");
  let downloads = [];
  const collect = (download) => downloads.push(download);
  page.on("download", collect);
  await page.getByTestId("download-pngs").click();
  await page
    .getByText(`3 PNGs ready · ${mixedItems} items with verified artwork`, {
      exact: true,
    })
    .waitFor({ timeout: 120_000 });
  await page.waitForTimeout(200);
  assert.equal(downloads.length, 3);
  assert.equal(
    await page.evaluate(() => window.exportDraws),
    allItems + mixedItems,
  );
  for (let i = 0; i < 3; i++)
    await downloads[i].saveAs(path.join(output, `split-${i + 1}.png`));
  page.off("download", collect);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator(".shop-card").first().waitFor();
  await page.getByRole("button", { name: "Options", exact: true }).click();
  const columns = page.getByLabel("Columns", { exact: true });
  await columns.fill("");
  await page.getByLabel("Birr rate", { exact: true }).click();
  assert.equal(
    await columns.inputValue(),
    "6",
    "Clearing columns changed it to 2",
  );
  await columns.fill("12");
  await page.getByRole("button", { name: /Show \d+ items/ }).click();
  const layout = await page
    .locator(".shop-item-grid")
    .first()
    .evaluate((grid) => ({
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
  assert.equal(layout.columns, 12);
  assert.equal(layout.overflow, false);
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await columns.fill("6");
  await page.getByLabel("PNG quality").selectOption("3240");
  await page.screenshot({ path: path.join(output, "mobile-options.png") });
  await page.getByRole("button", { name: /Show \d+ items/ }).click();
  await page.screenshot({ path: path.join(output, "mobile.png") });
  await downloadAndCheck(
    "mobile-ultra.png",
    page.getByRole("button", { name: "Download", exact: true }),
  );

  if (!process.env.GENERATOR_TEST_URL) {
    const daily = await browser.newPage();
    await daily.clock.install({ time: new Date("2026-09-09T23:50:00Z") });
    let dailyRequests = 0;
    await daily.route("**/shop-data.json", (route) => {
      dailyRequests++;
      return route.fulfill({
        json: {
          ...payload,
          updatedAt:
            dailyRequests === 1
              ? "2026-09-09T00:00:00Z"
              : "2026-09-10T00:00:00Z",
          generatedAt: String(dailyRequests),
        },
      });
    });
    await daily.goto(url);
    await daily.locator(".shop-card").first().waitFor();
    assert.equal(dailyRequests, 1);
    await daily.clock.fastForward(29 * 60_000);
    assert.equal(
      dailyRequests,
      1,
      "Shop fetched before the daily refresh boundary",
    );
    await daily.clock.fastForward(2 * 60_000);
    await daily.getByText("September 10, 2026", { exact: true }).waitFor();
    assert.equal(
      dailyRequests,
      2,
      "Shop failed to refresh on the next UTC day",
    );
    await daily.clock.fastForward(12 * 60 * 60_000);
    assert.equal(dailyRequests, 2, "Successful daily shop was polled again");
    await daily.reload();
    await daily.locator(".shop-card").first().waitFor();
    assert.equal(dailyRequests, 2, "Daily cache was not reused across reload");
    await daily.close();
    console.log(
      "Daily rollover: one request after publication time, no repeated successful fetches.",
    );

    const first = payload.items.find((item) => item.category === "skins");
    const fixture = {
      ...payload,
      items: [
        {
          ...first,
          image: "shop-assets/failure-test.webp",
          exportImage: "shop-assets/failure-test.webp",
          imageSources: [],
        },
      ],
    };
    const failurePage = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await failurePage.route("**/shop-data.json", (route) =>
      route.fulfill({ json: fixture }),
    );
    let attempts = 0;
    let fail = true;
    await failurePage.route(
      "**/shop-assets/failure-test.webp",
      async (route) => {
        attempts++;
        if (fail) await route.fulfill({ status: 503, body: "Unavailable" });
        else
          await route.fulfill({
            body: await readFile(path.join(root, first.exportImage)),
            contentType: "image/webp",
          });
      },
    );
    let badDownloads = 0;
    failurePage.on("download", () => badDownloads++);
    await failurePage.goto(url);
    await failurePage.locator(".shop-card").first().waitFor();
    await failurePage.getByTestId("download-pngs").click();
    await failurePage.locator(".export-status.has-error").waitFor();
    assert.equal(badDownloads, 0, "An incomplete PNG was downloaded");
    assert.ok(attempts >= 2, "Failed image was not retried");
    fail = false;
    const recovered = failurePage.waitForEvent("download");
    await failurePage.getByTestId("download-pngs").click();
    await (await recovered).saveAs(path.join(output, "recovered.png"));
    assert.equal(badDownloads, 1, "A failed image was cached permanently");
    await failurePage.close();
    console.log(
      "Image failure: retries, no initials export, and successful recovery verified.",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Generator verification passed: daily cache, image exports, split files, desktop and mobile.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
