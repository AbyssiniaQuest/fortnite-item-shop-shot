"use client";

import { useEffect, useState } from "react";
import { LIVE_SHOP_CACHE_KEY } from "@/lib/live-overlay";
import type { ShopPayload } from "@/lib/shop";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
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
      return cached.payload;
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

export function useLiveShopData() {
  const [payload, setPayload] = useState<ShopPayload | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let retryDelay = INITIAL_RETRY_MS;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const cached = readCachedPayload();

    if (cached) {
      setPayload(cached);
    }

    async function refresh() {
      controller = new AbortController();

      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const url = new URL(`${basePath}/shop-data.json`, window.location.origin);
        url.searchParams.set("liveRefresh", String(Date.now()));
        const response = await fetch(url, {
          cache: "no-store",
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

        setPayload(nextPayload);
        setIsRetrying(false);
        cachePayload(nextPayload);
        retryDelay = INITIAL_RETRY_MS;
        timer = window.setTimeout(refresh, REFRESH_INTERVAL_MS);
      } catch (error) {
        if (!isMounted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        setIsRetrying(true);
        timer = window.setTimeout(refresh, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
      }
    }

    void refresh();

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
