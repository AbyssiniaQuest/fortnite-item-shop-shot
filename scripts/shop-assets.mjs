import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  stat,
  readdir,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export async function readDailyShop(root, source) {
  const cache = join(root, ".shop-cache");
  const today = new Date().toISOString().slice(0, 10);
  await mkdir(cache, { recursive: true });
  const filename = join(cache, "daily-shop.json");
  const cached = await readFile(filename, "utf8")
    .then(JSON.parse)
    .catch(() => null);
  if (
    cached?.data?.date?.slice(0, 10) === today &&
    cached.data.entries?.length
  ) {
    console.log("Reusing today's cached API response.");
    return cached;
  }
  const response = await fetch(source, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`Fortnite-API responded with ${response.status}`);
  const payload = await response.json();
  if (
    !payload.data?.entries?.length ||
    payload.data.date?.slice(0, 10) !== today
  ) {
    throw new Error(
      "Today's shop is not available yet; keeping the existing published shop.",
    );
  }
  await writeFile(filename, JSON.stringify(payload));
  return payload;
}

export async function prepareShopAssets(root, items) {
  const directory = join(root, "public", "shop-assets");
  await mkdir(directory, { recursive: true });
  let index = 0;
  let completed = 0;
  const failures = [];
  async function prepare(item) {
    const sources = [...new Set([item.image, ...(item.imageSources ?? [])])];
    for (const source of sources) {
      const key = createHash("sha256")
        .update(`v1:${source}`)
        .digest("hex")
        .slice(0, 24);
      const exportName = `${key}.webp`;
      const previewName = `${key}-sm.webp`;
      const exportPath = join(directory, exportName);
      const previewPath = join(directory, previewName);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const existing = await Promise.all([
            stat(exportPath),
            stat(previewPath),
          ]).catch(() => null);
          if (!existing || existing.some((file) => file.size === 0)) {
            const response = await fetch(source, {
              signal: AbortSignal.timeout(20_000),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const bytes = Buffer.from(await response.arrayBuffer());
            const image = sharp(bytes, { limitInputPixels: 40_000_000 });
            const metadata = await image.metadata();
            if (!metadata.width || !metadata.height)
              throw new Error("Empty image");
            await image
              .clone()
              .resize(768, 768, { fit: "inside", withoutEnlargement: true })
              .webp({ quality: 94, alphaQuality: 100, effort: 4 })
              .toFile(exportPath);
            await image
              .clone()
              .resize(256, 256, { fit: "inside", withoutEnlargement: true })
              .webp({ quality: 82, alphaQuality: 100, effort: 4 })
              .toFile(previewPath);
          }
          item.exportImage = `shop-assets/${exportName}`;
          item.previewImage = `shop-assets/${previewName}`;
          return;
        } catch {
          if (attempt === 0)
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
    failures.push(item.name);
  }
  await Promise.all(
    Array.from({ length: Math.min(6, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index++];
        await prepare(item);
        if (++completed % 50 === 0 || completed === items.length)
          console.log(`Artwork verified: ${completed}/${items.length}`);
      }
    }),
  );
  if (failures.length)
    throw new Error(
      `Artwork unavailable for ${failures.length} items: ${failures.join(", ")}. Deployment stopped to avoid missing images.`,
    );
  // Retain recent shops for open tabs without growing the Pages artifact forever.
  const manifestPath = join(root, ".shop-cache", "asset-days.json");
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 3 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const previous = await readFile(manifestPath, "utf8")
    .then(JSON.parse)
    .catch(() => ({}));
  const manifest = Object.fromEntries(
    Object.entries(previous).filter(([day]) => day >= cutoff),
  );
  manifest[today] = items.flatMap((item) => [
    item.exportImage,
    item.previewImage,
  ]);
  const keep = new Set(Object.values(manifest).flat());
  for (const file of await readdir(directory)) {
    if (
      /^[a-f0-9]{24}(-sm)?\.webp$/.test(file) &&
      !keep.has(`shop-assets/${file}`)
    )
      await unlink(join(directory, file));
  }
  await writeFile(manifestPath, JSON.stringify(manifest));
}
