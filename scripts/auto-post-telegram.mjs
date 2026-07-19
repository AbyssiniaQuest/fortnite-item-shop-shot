import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const BASE_PATH = "/fortnite-item-shop-shot";
const OUT_DIR = path.resolve("out");
const TEMP_DIR = path.resolve(".auto-post-output");
const TELEGRAM_PHOTO_LIMIT = 9_500_000;
const TELEGRAM_DIMENSION_LIMIT = 9_800;
const allCategories = [
  "skins",
  "emotes",
  "pickaxes",
  "kicks",
  "bundles",
  "gliders",
  "wraps",
  "backBlings",
  "jamTracks",
  "uncategorized"
];
const categoryLimit = Number(process.env.AUTO_POST_CATEGORY_LIMIT) || allCategories.length;
const categories = allCategories.slice(0, Math.min(Math.max(categoryLimit, 1), allCategories.length));
const isDryRun = process.env.AUTO_POST_DRY_RUN === "true";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function captionDate(date = new Date()) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    timeZone: "Africa/Nairobi",
    year: "numeric"
  }).format(date);
}

function startStaticServer() {
  const server = http.createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname.startsWith(BASE_PATH)) {
        pathname = pathname.slice(BASE_PATH.length) || "/";
      }

      if (pathname.endsWith("/")) {
        pathname += "index.html";
      }

      const relativePath = pathname.replace(/^\/+/, "");
      const filePath = path.resolve(OUT_DIR, relativePath);

      if (!filePath.startsWith(`${OUT_DIR}${path.sep}`) && filePath !== OUT_DIR) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
      });
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : "Server error");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Unable to start the screenshot server."));
        return;
      }

      resolve({
        close: () => new Promise((closeResolve) => server.close(closeResolve)),
        url: `http://127.0.0.1:${address.port}${BASE_PATH}/`
      });
    });
  });
}

async function makeTelegramPhoto(pngPath, category) {
  const jpegPath = path.join(TEMP_DIR, `${category}.jpg`);
  const source = sharp(pngPath).flatten({ background: "#020617" });
  const metadata = await source.metadata();
  const width = metadata.width || 2160;
  const height = metadata.height || 2160;
  const maxHeight = Math.max(1, TELEGRAM_DIMENSION_LIMIT - width);
  let pipeline = source;

  if (height > maxHeight) {
    pipeline = pipeline.resize({
      fit: "inside",
      height: maxHeight,
      withoutEnlargement: true
    });
  }

  await pipeline
    .jpeg({ chromaSubsampling: "4:4:4", quality: 90 })
    .toFile(jpegPath);

  if (fs.statSync(jpegPath).size > TELEGRAM_PHOTO_LIMIT) {
    await sharp(pngPath)
      .flatten({ background: "#020617" })
      .resize({ fit: "inside", height: maxHeight, width: 2000, withoutEnlargement: true })
      .jpeg({ chromaSubsampling: "4:4:4", quality: 80 })
      .toFile(jpegPath);
  }

  if (fs.statSync(jpegPath).size > TELEGRAM_PHOTO_LIMIT) {
    throw new Error(`${category} image is still too large for Telegram.`);
  }

  return jpegPath;
}

async function renderCategoryPhotos(page) {
  const output = [];

  for (const category of categories) {
    const categoryButton = page.getByTestId("category-select");
    await categoryButton.click();

    const checkboxes = page.locator('[data-testid^="category-check-"]');
    const checkboxCount = await checkboxes.count();

    for (let index = 0; index < checkboxCount; index += 1) {
      await checkboxes.nth(index).setChecked(false);
    }

    await page.getByTestId(`category-check-${category}`).setChecked(true);
    await categoryButton.click();
    await page.waitForTimeout(150);

    const itemCount = await page.locator('[data-testid="shop-canvas"] article').count();

    if (itemCount === 0) {
      continue;
    }

    const pngPath = path.join(TEMP_DIR, `${category}.png`);
    const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
    await page.getByTestId("download-pngs").click();
    const download = await downloadPromise;
    await download.saveAs(pngPath);
    await page.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="download-pngs"]');

        return button instanceof HTMLButtonElement && !button.disabled;
      },
      undefined,
      { timeout: 30_000 }
    );

    output.push(await makeTelegramPhoto(pngPath, category));
    console.log(`Rendered ${category} (${itemCount} items).`);
  }

  return output;
}

async function sendTelegramAlbum(files, caption) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured.");
  }

  const form = new FormData();
  form.append("chat_id", chatId);

  if (files.length === 1) {
    const bytes = fs.readFileSync(files[0]);
    form.append("caption", caption);
    form.append("photo", new Blob([bytes], { type: "image/jpeg" }), path.basename(files[0]));

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      body: form,
      method: "POST"
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(`Telegram rejected the photo: ${result.description || response.statusText}`);
    }

    return;
  }

  const media = files.map((file, index) => {
    const attachment = `photo${index}`;
    const bytes = fs.readFileSync(file);

    form.append(attachment, new Blob([bytes], { type: "image/jpeg" }), path.basename(file));

    return {
      ...(index === 0 ? { caption } : {}),
      media: `attach://${attachment}`,
      type: "photo"
    };
  });
  form.append("media", JSON.stringify(media));

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
    body: form,
    method: "POST"
  });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(`Telegram rejected the album: ${result.description || response.statusText}`);
  }
}

const configPath = path.resolve("public/auto-post-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const caption = String(config.caption || "Today's item shop {date} 🔥").replaceAll(
  "{date}",
  captionDate()
);

fs.rmSync(TEMP_DIR, { force: true, recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

const staticServer = await startStaticServer();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });
  await page.goto(staticServer.url, { waitUntil: "networkidle" });
  await page.locator('[data-testid="shop-canvas"] article').first().waitFor({ state: "visible" });

  const files = await renderCategoryPhotos(page);

  if (files.length === 0) {
    throw new Error("No shop category images were generated.");
  }

  if (isDryRun) {
    console.log(`Dry run generated ${files.length} Telegram-ready shop images.`);
  } else {
    await sendTelegramAlbum(files, caption);
    config.lastPostedAt = new Date().toISOString();
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`Posted ${files.length} shop images to Telegram.`);
  }
} finally {
  await browser.close();
  await staticServer.close();
  fs.rmSync(TEMP_DIR, { force: true, recursive: true });
}
