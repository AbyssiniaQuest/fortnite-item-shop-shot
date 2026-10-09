"use client";

import { useEffect, useState } from "react";
import {
  dedupeShopItems,
  mapShopEntry,
  SHOP_CATEGORIES,
  SHOP_URL,
  type ShopPayload,
  type ShopResponse,
} from "@/lib/shop";

export const DAILY_SHOP_CACHE_KEY = "abyssinia-shop-daily-v2";
const DAY = 86_400_000;
const PUBLISH_GRACE = 20 * 60_000;
const MAX_REFRESH_RETRY = 30 * 60_000;
let request: Promise<ShopPayload> | undefined;
let memory: ShopPayload | null = null;

export function expectedShopDay(now = Date.now()) {
  return new Date(now - PUBLISH_GRACE).toISOString().slice(0, 10);
}

export function isShopPayload(value: unknown): value is ShopPayload {
  const p = value as ShopPayload | null;
  return Boolean(
    p &&
      typeof p.updatedAt === "string" &&
      Number.isFinite(Date.parse(p.updatedAt)) &&
      Array.isArray(p.items) &&
      p.items.length &&
      p.items.every(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.image === "string" &&
          typeof item.type === "string" &&
          typeof item.rarity === "string" &&
          typeof item.season === "string" &&
          Number.isFinite(item.price) &&
          SHOP_CATEGORIES.includes(item.category),
      ),
  );
}

function rememberShop(payload: ShopPayload) {
  memory = { ...payload, items: dedupeShopItems(payload.items) };
  try {
    localStorage.setItem(DAILY_SHOP_CACHE_KEY, JSON.stringify(memory));
  } catch {
    /* Storage is optional. */
  }
  return memory;
}

async function fetchShop(cached: ShopPayload | null) {
  let published: ShopPayload | null = null;
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/shop-data.json`,
      { cache: "no-cache", signal: AbortSignal.timeout(20_000) },
    );
    if (!response.ok) throw new Error(`Shop request failed (${response.status})`);
    const payload: unknown = await response.json();
    if (!isShopPayload(payload)) throw new Error("Incomplete published shop");
    published = payload;
    if (payload.updatedAt.slice(0, 10) >= expectedShopDay())
      return rememberShop(payload);
  } catch {
    // Pages publication is optional: the public API can recover a delayed build.
  }

  try {
    const response = await fetch(SHOP_URL, {
      cache: "no-cache",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`API request failed (${response.status})`);
    const api: ShopResponse = await response.json();
    const date = api.data?.date;
    if (
      !date ||
      !Number.isFinite(Date.parse(date)) ||
      date.slice(0, 10) < expectedShopDay() ||
      !Array.isArray(api.data?.entries)
    ) throw new Error("Today's API shop is not available yet");

    const items = dedupeShopItems(api.data.entries.map(mapShopEntry).filter(
      (item): item is NonNullable<typeof item> => item !== null,
    ));
    // Reuse mirrored artwork only when the same official image is still offered.
    const artwork = new Map(
      [...(cached?.items ?? []), ...(published?.items ?? [])].map((item) => [item.image, item]),
    );
    const payload: ShopPayload = {
      source: SHOP_URL,
      updatedAt: date,
      generatedAt: new Date().toISOString(),
      cacheSeconds: 86400,
      items: items.map((item) => {
        const existing = (item.imageSources ?? [item.image])
          .map((source) => artwork.get(source))
          .find((candidate) => candidate?.exportImage);
        return existing ? {
          ...item,
          image: existing.image,
          exportImage: existing.exportImage,
          previewImage: existing.previewImage,
        } : item;
      }),
    };
    if (!isShopPayload(payload)) throw new Error("Incomplete API shop");
    return rememberShop(payload);
  } catch {
    if (published && (!cached || published.updatedAt >= cached.updatedAt))
      return rememberShop(published);
    throw new Error("The shop could not be synced. Check your connection and retry.");
  }
}

export function useDailyShopData() {
  const [shop, setShop] = useState<ShopPayload | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: number;
    let attempts = 0;
    let refreshing = false;
    let lastAttemptAt = 0;
    let cached = memory;
    if (!cached) {
      try {
        const value: unknown = JSON.parse(
          localStorage.getItem(DAILY_SHOP_CACHE_KEY) ?? "null",
        );
        if (isShopPayload(value)) cached = value;
      } catch {
        /* A corrupt cache must not prevent a network recovery. */
      }
    }
    if (cached) setShop(cached);

    function scheduleTomorrow() {
      const now = Date.now();
      const next =
        Math.floor((now - PUBLISH_GRACE) / DAY) * DAY + DAY + PUBLISH_GRACE;
      timer = window.setTimeout(() => {
        attempts = 0;
        void refresh();
      }, next - now);
    }

    async function refresh() {
      if (!active || refreshing) return;
      refreshing = true;
      lastAttemptAt = Date.now();
      window.clearTimeout(timer);
      setIsRefreshing(true);
      try {
        request ??= fetchShop(cached).finally(() => {
          request = undefined;
        });
        const payload = await request;
        if (!active) return;
        cached = payload;
        setShop((current) =>
          current?.generatedAt === payload.generatedAt &&
          current?.updatedAt === payload.updatedAt
            ? current
            : payload,
        );
        setError("");
        if (payload.updatedAt.slice(0, 10) < expectedShopDay()) {
          throw new Error(
            "Today's shop could not be synced yet. Showing the last available shop and retrying automatically.",
          );
        }
        attempts = 0;
        scheduleTomorrow();
      } catch (reason) {
        if (!active) return;
        setError(
          reason instanceof Error ? reason.message : "Unable to load the shop.",
        );
        // Publication can arrive hours late. Back off until today's shop exists,
        // then return to the single daily refresh schedule.
        const retryDelay = Math.min(
          60_000 * 2 ** Math.min(attempts++, 5),
          MAX_REFRESH_RETRY,
        );
        timer = window.setTimeout(refresh, retryDelay);
      } finally {
        refreshing = false;
        if (active) setIsRefreshing(false);
      }
    }

    if (
      retryKey ||
      !cached ||
      cached.updatedAt.slice(0, 10) < expectedShopDay()
    )
      void refresh();
    else scheduleTomorrow();

    function onVisible() {
      if (
        document.visibilityState === "visible" &&
        (!cached || cached.updatedAt.slice(0, 10) < expectedShopDay()) &&
        Date.now() - lastAttemptAt >= 60_000
      ) {
        window.clearTimeout(timer);
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [retryKey]);

  return {
    shop,
    error,
    isRefreshing,
    retry: () => setRetryKey((key) => key + 1),
  };
}
