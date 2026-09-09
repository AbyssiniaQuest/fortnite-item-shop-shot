"use client";

import { useEffect, useState } from "react";
import { dedupeShopItems, SHOP_CATEGORIES, type ShopPayload } from "@/lib/shop";

export const DAILY_SHOP_CACHE_KEY = "abyssinia-shop-daily-v2";
const DAY = 86_400_000;
const PUBLISH_GRACE = 20 * 60_000;
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

async function fetchShop() {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/shop-data.json`,
    {
      cache: "no-cache",
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok)
    throw new Error(
      "The shop could not be loaded. Check your connection and retry.",
    );
  const payload: unknown = await response.json();
  if (!isShopPayload(payload))
    throw new Error("Shop data is incomplete. Please retry shortly.");
  memory = { ...payload, items: dedupeShopItems(payload.items) };
  try {
    localStorage.setItem(DAILY_SHOP_CACHE_KEY, JSON.stringify(memory));
  } catch {
    /* Storage is optional. */
  }
  return memory;
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
      if (!active) return;
      setIsRefreshing(true);
      try {
        request ??= fetchShop().finally(() => {
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
            "The new shop is still being published. Showing the last available shop.",
          );
        }
        attempts = 0;
        scheduleTomorrow();
      } catch (reason) {
        if (!active) return;
        setError(
          reason instanceof Error ? reason.message : "Unable to load the shop.",
        );
        // Retry only a failed/delayed daily refresh, never poll a successful shop.
        if (++attempts < 4)
          timer = window.setTimeout(refresh, 60_000 * attempts);
        else scheduleTomorrow();
      } finally {
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
        cached &&
        cached.updatedAt.slice(0, 10) < expectedShopDay() &&
        attempts === 0
      ) {
        window.clearTimeout(timer);
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [retryKey]);

  return {
    shop,
    error,
    isRefreshing,
    retry: () => setRetryKey((key) => key + 1),
  };
}
