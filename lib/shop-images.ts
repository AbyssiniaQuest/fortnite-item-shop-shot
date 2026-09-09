import type { ShopItem } from "@/lib/shop";

export function shopAssetUrl(source: string) {
  return source.startsWith("shop-assets/")
    ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/${source}`
    : source;
}

export function previewImageUrl(item: ShopItem) {
  return shopAssetUrl(item.previewImage ?? item.exportImage ?? item.image);
}

// Cache only successful decodes. A failed request must be retryable on the next export.
const decoded = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();
const MAX_DECODED_IMAGES = 48;

async function decodeImage(source: string, attempt: number) {
  const cached = decoded.get(source);
  if (cached) return cached;
  const url = shopAssetUrl(source);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  let objectUrl = "";
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: attempt ? "reload" : "force-cache",
      mode: "cors",
    });
    if (!response.ok)
      throw new Error(`Image request failed (${response.status})`);
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith("image/"))
      throw new Error("Invalid image response");
    objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("Empty image");
    if (decoded.size >= MAX_DECODED_IMAGES)
      decoded.delete(decoded.keys().next().value!);
    decoded.set(source, image);
    return image;
  } finally {
    window.clearTimeout(timeout);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function loadExportImage(
  item: ShopItem,
): Promise<HTMLImageElement> {
  const sources = [
    ...new Set(
      [item.exportImage, item.image, ...(item.imageSources ?? [])].filter(
        Boolean,
      ),
    ),
  ] as string[];
  for (const source of sources) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        let request = pending.get(source);
        if (!request) {
          request = decodeImage(source, attempt);
          pending.set(source, request);
        }
        return await request;
      } catch {
        if (attempt === 0)
          await new Promise((resolve) => window.setTimeout(resolve, 400));
      } finally {
        pending.delete(source);
      }
    }
  }
  throw new Error(
    `Artwork could not load for ${item.name}. Check your connection and retry. No incomplete PNG was saved.`,
  );
}
