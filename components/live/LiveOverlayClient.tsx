"use client";

import { useEffect, useState } from "react";
import { LiveOverlayView } from "@/components/live/LiveOverlayView";
import { useLiveShopData } from "@/components/live/useLiveShopData";
import {
  DEFAULT_LIVE_OVERLAY_SETTINGS,
  parseLiveOverlaySearch,
  type LiveOverlaySettings
} from "@/lib/live-overlay";

export function LiveOverlayClient() {
  const [settings, setSettings] = useState<LiveOverlaySettings>(DEFAULT_LIVE_OVERLAY_SETTINGS);
  const { payload, isRetrying } = useLiveShopData();

  useEffect(() => {
    setSettings(parseLiveOverlaySearch(window.location.search));
    document.documentElement.classList.add("live-overlay-document");

    return () => document.documentElement.classList.remove("live-overlay-document");
  }, []);

  return (
    <LiveOverlayView
      items={payload?.items ?? []}
      settings={settings}
      standalone
      unavailable={!payload && isRetrying}
    />
  );
}
