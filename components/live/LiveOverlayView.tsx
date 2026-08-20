"use client";

import { useMemo } from "react";
import { VerticalTicker } from "@/components/live/VerticalTicker";
import { filterLiveItems, type LiveOverlaySettings } from "@/lib/live-overlay";
import type { ShopItem } from "@/lib/shop";

type LiveOverlayViewProps = {
  items: ShopItem[];
  settings: LiveOverlaySettings;
  paused?: boolean;
  standalone?: boolean;
  unavailable?: boolean;
};

export function LiveOverlayView({
  items,
  settings,
  paused = false,
  standalone = false,
  unavailable = false
}: LiveOverlayViewProps) {
  const matchingItems = useMemo(() => filterLiveItems(items, settings), [items, settings]);
  const hasVisibleFields =
    settings.showImage ||
    settings.showName ||
    settings.showMeta ||
    settings.showVbucks ||
    settings.showBirr ||
    settings.showDescription;
  const className = `${standalone ? "live-overlay-root" : "live-overlay-preview"} ${
    settings.background === "solid" ? "live-overlay--solid" : "live-overlay--transparent"
  }`;

  return (
    <main className={className} data-testid={standalone ? "clean-live-overlay" : "live-preview"}>
      {matchingItems.length > 0 && hasVisibleFields ? (
        <VerticalTicker items={matchingItems} paused={paused} settings={settings} />
      ) : hasVisibleFields ? (
        <div className="live-overlay-status" role="status">
          {unavailable ? "Shop data unavailable - retrying" : "No matching shop items"}
        </div>
      ) : null}
    </main>
  );
}
