import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(rootDir, "public", "shop-data.json");
const shopUrl = "https://fortnite-api.com/v2/shop";

function cleanDevName(value) {
  if (!value) {
    return undefined;
  }

  const quotedName = value.match(/\[(.*?)\]/)?.[1];
  return quotedName ?? value.replaceAll("_", " ");
}

function firstDisplayImage(entry) {
  return entry.newDisplayAsset?.renderImages?.find((image) => image.image)?.image;
}

function categoryFromType(entry, typeValue, typeLabel) {
  const normalized = `${typeValue ?? ""} ${typeLabel ?? ""}`.toLowerCase();

  if (entry.bundle) return "bundles";
  if (entry.tracks?.length) return "jamTracks";
  if (normalized.includes("outfit") || normalized.includes("character")) return "skins";
  if (normalized.includes("emote") || normalized.includes("dance")) return "emotes";
  if (normalized.includes("pickaxe") || normalized.includes("harvesting")) return "pickaxes";
  if (normalized.includes("shoe") || normalized.includes("kick")) return "kicks";
  if (normalized.includes("glider")) return "gliders";
  if (normalized.includes("wrap")) return "wraps";
  if (normalized.includes("backpack") || normalized.includes("back bling")) return "backBlings";
  if (normalized.includes("music") || normalized.includes("instrument") || normalized.includes("mic")) return "jamTracks";

  return "uncategorized";
}

function mapShopEntry(entry) {
  const primaryItem = entry.items?.[0] ?? entry.brItems?.[0];
  const primaryInstrument = entry.instruments?.[0];
  const primaryTrack = entry.tracks?.[0];
  const primaryLegoKit = entry.legoKits?.[0];
  const itemName = entry.bundle?.name ?? primaryItem?.name;
  const name =
    itemName ?? primaryInstrument?.name ?? primaryTrack?.title ?? primaryLegoKit?.name ?? cleanDevName(entry.devName);
  const image =
    entry.bundle?.image ??
    firstDisplayImage(entry) ??
    primaryItem?.images?.featured ??
    primaryItem?.images?.icon ??
    primaryItem?.images?.smallIcon ??
    primaryInstrument?.images?.large ??
    primaryInstrument?.images?.small ??
    primaryTrack?.albumArt ??
    primaryLegoKit?.image;
  const price = entry.finalPrice ?? entry.price?.finalPrice ?? entry.regularPrice ?? entry.price?.regularPrice ?? 0;

  if (!name || !image) {
    return null;
  }

  const type = entry.bundle
    ? "Bundle"
    : primaryItem?.type?.displayValue ??
      primaryInstrument?.type?.displayValue ??
      (primaryTrack ? "Jam Track" : primaryLegoKit ? "LEGO Kit" : "Cosmetic");

  return {
    id: entry.offerId ?? primaryItem?.id ?? primaryInstrument?.id ?? primaryTrack?.id ?? name,
    name,
    type,
    image,
    rarity:
      primaryItem?.rarity?.displayValue ??
      primaryInstrument?.rarity?.displayValue ??
      primaryItem?.rarity?.value ??
      primaryInstrument?.rarity?.value ??
      (entry.bundle ? "Bundle" : "Unknown"),
    season:
      primaryItem?.introduction?.text ??
      (primaryItem?.introduction?.chapter && primaryItem?.introduction?.season
        ? `Chapter ${primaryItem.introduction.chapter}, Season ${primaryItem.introduction.season}`
        : "Unknown season"),
    price,
    category: categoryFromType(entry, primaryItem?.type?.value ?? primaryInstrument?.type?.value, type)
  };
}

function dedupeShopItems(items) {
  const uniqueItems = [];
  const positions = new Map();

  for (const item of items) {
    const identity = [item.category, item.name, item.type]
      .map((value) => value.trim().replace(/\s+/g, " ").toLowerCase())
      .join("|");
    const existingPosition = positions.get(identity);

    if (existingPosition === undefined) {
      positions.set(identity, uniqueItems.length);
      uniqueItems.push(item);
      continue;
    }

    const existing = uniqueItems[existingPosition];
    if (item.price > 0 && (existing.price <= 0 || item.price < existing.price)) {
      uniqueItems[existingPosition] = item;
    }
  }

  return uniqueItems;
}

const response = await fetch(shopUrl, {
  headers: {
    Accept: "application/json"
  }
});

if (!response.ok) {
  throw new Error(`Fortnite-API responded with ${response.status}`);
}

const payload = await response.json();
const items = dedupeShopItems((payload.data?.entries ?? []).map(mapShopEntry).filter(Boolean));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      source: shopUrl,
      updatedAt: payload.data?.date ?? new Date().toISOString(),
      cacheSeconds: 86400,
      generatedAt: new Date().toISOString(),
      items
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${items.length} shop items to ${outputPath}`);
