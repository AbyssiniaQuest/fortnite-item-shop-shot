import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve("out");
const basePath = "/fortnite-item-shop-shot";
const port = Number(process.env.LIVE_TEST_PORT ?? 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl ?? "/", `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === basePath) {
    pathname = "/";
  } else if (pathname.startsWith(`${basePath}/`)) {
    pathname = pathname.slice(basePath.length);
  }

  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  return path.resolve(root, `.${pathname}`);
}

const server = createServer(async (request, response) => {
  try {
    let filePath = resolveRequestPath(request.url);
    if (!filePath.startsWith(root)) {
      throw new Error("Invalid path");
    }

    const fileStats = await stat(filePath).catch(() => null);
    if (!fileStats?.isFile() && path.extname(filePath) === "") {
      filePath = `${filePath}.html`;
    }

    const data = await readFile(filePath);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentTypes[path.extname(filePath)] ?? "application/octet-stream"
    });
    response.end(data);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await Promise.all([
  stat(path.join(root, "index.html")),
  stat(path.join(root, "live", "index.html")),
  stat(path.join(root, "live", "overlay", "index.html"))
]);

await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const browserErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    browserErrors.push(`${message.text()} ${message.location().url}`.trim());
  }
});
page.on("pageerror", (error) => browserErrors.push(error.message));

try {
  const rootUrl = `http://127.0.0.1:${port}${basePath}/`;
  await page.goto(rootUrl, { waitUntil: "domcontentloaded" });
  await assert.doesNotReject(() => page.getByRole("heading", { name: "Fortnite Item Shop Generator" }).waitFor());
  assert.equal(await page.getByTestId("category-select").textContent().then((text) => text?.includes("1 selected")), true);
  assert.equal(await page.getByLabel("Columns").inputValue(), "6");
  assert.equal(await page.getByRole("checkbox", { name: "V-Bucks", exact: true }).isChecked(), true);
  assert.equal(await page.getByRole("checkbox", { name: "Birr", exact: true }).isChecked(), true);
  assert.equal(await page.getByRole("checkbox", { name: "Description", exact: true }).isChecked(), false);
  assert.equal(await page.getByRole("button", { name: "Download PNG" }).isVisible(), true);
  assert.equal(await page.getByRole("link", { name: "Live Overlay" }).isVisible(), true);

  await page.goto(`${rootUrl}live/`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("live-match-count").waitFor();
  assert.equal(await page.getByRole("heading", { name: "Fortnite Item Shop Live Overlay" }).isVisible(), true);
  assert.equal(await page.getByTestId("live-orientation-vertical").getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByTestId("live-direction-up").getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByTestId("live-showImage").isChecked(), true);
  assert.equal(await page.getByTestId("live-showName").isChecked(), true);
  assert.equal(await page.getByTestId("live-showMeta").isChecked(), true);
  assert.equal(await page.getByTestId("live-showVbucks").isChecked(), true);
  assert.equal(await page.getByTestId("live-showBirr").isChecked(), true);
  assert.equal(await page.getByTestId("live-showDescription").isChecked(), false);

  await page.getByTestId("live-category-select").click();
  await page.getByRole("button", { name: "Mark all", exact: true }).click();
  await page.getByTestId("live-showBirr").uncheck();
  const generatedUrl = await page.getByTestId("generated-live-url").textContent();
  assert.match(generatedUrl ?? "", /categories=skins%2Cemotes%2Cpickaxes/);
  assert.match(generatedUrl ?? "", /birr=0/);
  await page.getByTestId("live-image-only").click();
  await page.getByTestId("live-orientation-horizontal").click();
  const imageOnlyGeneratedUrl = await page.getByTestId("generated-live-url").textContent();
  assert.match(imageOnlyGeneratedUrl ?? "", /image=1/);
  assert.match(imageOnlyGeneratedUrl ?? "", /nameVisible=0/);
  assert.match(imageOnlyGeneratedUrl ?? "", /meta=0/);
  assert.match(imageOnlyGeneratedUrl ?? "", /vbucks=0/);
  assert.match(imageOnlyGeneratedUrl ?? "", /orientation=horizontal/);
  assert.match(imageOnlyGeneratedUrl ?? "", /direction=left/);
  assert.match(imageOnlyGeneratedUrl ?? "", /background=transparent/);

  const shopPayload = JSON.parse(await readFile(path.resolve("public/shop-data.json"), "utf8"));
  const firstSkin = shopPayload.items.find((item) => item.category === "skins");
  assert.ok(firstSkin, "Expected at least one skin in shop-data.json");
  const overlayParams = new URLSearchParams({
    categories: "skins",
    vbucks: "1",
    birr: "1",
    description: "0",
    birrRate: "2",
    direction: "up",
    speed: "120",
    gap: "16",
    cardWidth: "320",
    background: "transparent"
  });
  const overlayUrl = `${rootUrl}live/overlay/?${overlayParams}`;

  for (const viewport of [
    { width: 320, height: 900 },
    { width: 360, height: 1000 },
    { width: 540, height: 960 },
    { width: 1080, height: 1920 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(overlayUrl, { waitUntil: "domcontentloaded" });
    await page.locator("[data-live-item='true']").first().waitFor();
    await page.waitForTimeout(250);

    const metrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("[data-live-item='true']"));
      const ticker = document.querySelector(".live-ticker");
      const firstCard = cards[0]?.getBoundingClientRect();
      const lastCard = cards.at(-1)?.getBoundingClientRect();
      return {
        cardCategories: cards.map((card) => card.getAttribute("data-category")),
        renderedCount: cards.length,
        expectedMaximum: firstCard
          ? Math.ceil(window.innerHeight / (firstCard.height + 16)) + 5
          : 0,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        firstTop: firstCard?.top ?? 0,
        lastBottom: lastCard?.bottom ?? 0,
        tickerHeight: ticker?.getBoundingClientRect().height ?? 0,
        htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
        bodyBackground: getComputedStyle(document.body).backgroundColor
      };
    });

    assert.equal(metrics.cardCategories.every((category) => category === "skins"), true);
    assert.equal(metrics.hasHorizontalOverflow, false);
    assert.equal(metrics.htmlBackground, "rgba(0, 0, 0, 0)");
    assert.equal(metrics.bodyBackground, "rgba(0, 0, 0, 0)");
    assert.ok(metrics.renderedCount <= metrics.expectedMaximum, "Ticker rendered beyond its viewport buffer");
    assert.ok(metrics.firstTop <= 0, "Ticker does not cover the top of the viewport");
    assert.ok(metrics.lastBottom >= metrics.tickerHeight, "Ticker leaves a blank area below the viewport");
  }

  const cleanOverlay = page.getByTestId("clean-live-overlay");
  assert.equal(await cleanOverlay.count(), 1);
  assert.equal(await page.locator("header, nav, button, input, select").count(), 0);
  const firstCardText = await page.locator("[data-live-item='true']").first().textContent();
  assert.match(firstCardText ?? "", new RegExp(firstSkin.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(firstCardText ?? "", new RegExp(`${firstSkin.price.toLocaleString("en-US")} V-Bucks`));
  assert.match(firstCardText ?? "", new RegExp(`${(firstSkin.price * 2).toLocaleString("en-US")} Birr`));

  const track = page.getByTestId("live-ticker-track");
  const transformBefore = await track.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(300);
  const transformAfter = await track.evaluate((element) => getComputedStyle(element).transform);
  assert.notEqual(transformAfter, transformBefore, "Ticker transform did not advance");

  const imageOnlyParams = new URLSearchParams({
    categories: "skins",
    image: "1",
    nameVisible: "0",
    meta: "0",
    vbucks: "0",
    birr: "0",
    description: "0",
    birrRate: "1",
    orientation: "horizontal",
    direction: "left",
    speed: "120",
    gap: "12",
    cardWidth: "220",
    background: "transparent"
  });
  await page.setViewportSize({ width: 540, height: 320 });
  await page.goto(`${rootUrl}live/overlay/?${imageOnlyParams}`, { waitUntil: "domcontentloaded" });
  const imageOnlyCards = page.locator(".live-item-card--image-only");
  await imageOnlyCards.first().waitFor();
  await page.waitForTimeout(250);
  const imageOnlyMetrics = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".live-item-card--image-only"));
    const first = cards[0]?.getBoundingClientRect();
    const last = cards.at(-1)?.getBoundingClientRect();
    const articleStyle = cards[0] ? getComputedStyle(cards[0]) : null;
    const art = cards[0]?.querySelector(".live-item-card__art");
    return {
      count: cards.length,
      maximum: first ? Math.ceil(window.innerWidth / (first.width + 12)) + 5 : 0,
      contentBlocks: document.querySelectorAll(".live-item-card__content").length,
      firstLeft: first?.left ?? 0,
      lastRight: last?.right ?? 0,
      articleBackground: articleStyle?.backgroundColor,
      articleBorder: articleStyle?.borderTopWidth,
      articleShadow: articleStyle?.boxShadow,
      artBackground: art ? getComputedStyle(art).backgroundColor : "",
      trackDirection: getComputedStyle(document.querySelector("[data-testid='live-ticker-track']")).flexDirection,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      overflowX: document.documentElement.scrollWidth > window.innerWidth
    };
  });
  assert.equal(imageOnlyMetrics.contentBlocks, 0);
  assert.equal(imageOnlyMetrics.articleBackground, "rgba(0, 0, 0, 0)");
  assert.equal(imageOnlyMetrics.artBackground, "rgba(0, 0, 0, 0)");
  assert.equal(imageOnlyMetrics.articleBorder, "0px");
  assert.equal(imageOnlyMetrics.articleShadow, "none");
  assert.equal(imageOnlyMetrics.trackDirection, "row");
  assert.equal(imageOnlyMetrics.bodyBackground, "rgba(0, 0, 0, 0)");
  assert.equal(imageOnlyMetrics.overflowX, false);
  assert.ok(imageOnlyMetrics.count <= imageOnlyMetrics.maximum);
  assert.ok(imageOnlyMetrics.firstLeft <= 0);
  assert.ok(imageOnlyMetrics.lastRight >= 540);
  const horizontalTrack = page.getByTestId("live-ticker-track");
  const horizontalBefore = await horizontalTrack.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(300);
  const horizontalAfter = await horizontalTrack.evaluate((element) => getComputedStyle(element).transform);
  assert.notEqual(horizontalAfter, horizontalBefore, "Horizontal ticker transform did not advance");

  imageOnlyParams.set("background", "solid");
  await page.goto(`${rootUrl}live/overlay/?${imageOnlyParams}`, { waitUntil: "domcontentloaded" });
  await page.locator(".live-item-card--image-only").first().waitFor();
  const solidBackgrounds = await page.evaluate(() => ({
    root: getComputedStyle(document.querySelector(".live-overlay-root")).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    art: getComputedStyle(document.querySelector(".live-item-card__art")).backgroundColor
  }));
  assert.equal(solidBackgrounds.root, "rgba(0, 0, 0, 0)");
  assert.equal(solidBackgrounds.body, "rgba(0, 0, 0, 0)");
  assert.equal(solidBackgrounds.art, "rgb(17, 24, 39)");

  const singleItemParams = new URLSearchParams(overlayParams);
  singleItemParams.set("name", firstSkin.name);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`${rootUrl}live/overlay/?${singleItemParams}`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-live-item='true']").first().waitFor();
  const repeatedNames = await page.locator("[data-live-item='true'] .live-item-card__name").allTextContents();
  assert.ok(repeatedNames.length > 1);
  assert.equal(repeatedNames.every((name) => name === firstSkin.name), true);

  assert.deepEqual(browserErrors, []);
  console.log("Live overlay verification passed.");
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
