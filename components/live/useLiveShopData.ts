"use client";

import { useEffect, useRef, useState } from "react";
import { LIVE_SHOP_CACHE_KEY } from "@/lib/live-overlay";
import { dedupeShopItems, type ShopPayload } from "@/lib/shop";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHOP_REFRESH_MINUTE_UTC = 20;
const INITIAL_RETRY_MS = 5000;
const MAX_RETRY_MS = 60_000;
const MAX_CACHE_AGE_MS = 36 * 60 * 60 * 1000;

type CachedShopPayload = {
  savedAt: number;
  payload: ShopPayload;
};

function isShopPayload(value: unknown): value is ShopPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<ShopPayload>;
  return (
    typeof payload.updatedAt === "string" &&
    Array.isArray(payload.items) &&
    payload.items.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.image === "string" &&
        typeof item.category === "string" &&
        typeof item.price === "number"
    )
  );
}

function readCachedPayload() {
  try {
    const raw = window.localStorage.getItem(LIVE_SHOP_CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as Partial<CachedShopPayload>) : null;

    if (
      cached &&
      typeof cached.savedAt === "number" &&
      Date.now() - cached.savedAt <= MAX_CACHE_AGE_MS &&
      isShopPayload(cached.payload)
    ) {
      return { savedAt: cached.savedAt, payload: cached.payload };
    }
  } catch {
    // Storage can be unavailable in a locked-down browser source.
  }

  return null;
}

function cachePayload(payload: ShopPayload) {
  try {
    window.localStorage.setItem(
      LIVE_SHOP_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), payload } satisfies CachedShopPayload)
    );
  } catch {
    // A successful in-memory refresh is still useful when storage is unavailable.
  }
}

function normalizePayload(payload: ShopPayload): ShopPayload {
  const items = dedupeShopItems(payload.items);
  return items.length === payload.items.length ? payload : { ...payload, items };
}

function payloadVersion(payload: ShopPayload) {
  return `${payload.updatedAt}|${payload.items.map((item) => `${item.id}:${item.price}`).join(",")}`;
}

function latestScheduledRefresh(now = Date.now()) {
  const date = new Date(now);
  const todayRefresh = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    SHOP_REFRESH_MINUTE_UTC
  );

  return todayRefresh <= now ? todayRefresh : todayRefresh - DAY_MS;
}

function nextScheduledRefreshDelay(now = Date.now()) {
  const latestRefresh = latestScheduledRefresh(now);
  return Math.max(1000, latestRefresh + DAY_MS - now);
}

export function useLiveShopData() {
  const [payload, setPayload] = useState<ShopPayload | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const payloadVersionRef = useRef("");

  useEffect(() => {
    let isMounted = true;
    let retryDelay = INITIAL_RETRY_MS;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const cached = readCachedPayload();

    if (cached) {
      const normalizedCached = normalizePayload(cached.payload);
      payloadVersionRef.current = payloadVersion(normalizedCached);
      setPayload(normalizedCached);
    }

    function scheduleNextRefresh() {
      timer = window.setTimeout(refresh, nextScheduledRefreshDelay());
    }

    async function refresh() {
      controller = new AbortController();

      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const url = new URL(`${basePath}/shop-data.json`, window.location.origin);
        const response = await fetch(url, {
          cache: "no-cache",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Shop data request failed with ${response.status}.`);
        }

        const nextPayload: unknown = await response.json();
        if (!isShopPayload(nextPayload)) {
          throw new Error("Shop data response is invalid.");
        }

        if (!isMounted) {
          return;
        }

        const normalizedPayload = normalizePayload(nextPayload);
        const nextVersion = payloadVersion(normalizedPayload);
        if (nextVersion !== payloadVersionRef.current) {
          payloadVersionRef.current = nextVersion;
          setPayload(normalizedPayload);
        }
        cachePayload(normalizedPayload);
        setIsRetrying(false);
        retryDelay = INITIAL_RETRY_MS;
        scheduleNextRefresh();
      } catch (error) {
        if (!isMounted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        setIsRetrying(true);
        timer = window.setTimeout(refresh, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
      }
    }

    if (cached && cached.savedAt >= latestScheduledRefresh()) {
      scheduleNextRefresh();
    } else {
      void refresh();
    }

    return () => {
      isMounted = false;
      controller?.abort();
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  return {
    payload,
    isRetrying,
    hasData: Boolean(payload?.items.length)
  };
}
