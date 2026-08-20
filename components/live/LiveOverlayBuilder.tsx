"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LiveOverlayView } from "@/components/live/LiveOverlayView";
import { useLiveShopData } from "@/components/live/useLiveShopData";
import {
  buildLiveOverlaySearch,
  DEFAULT_LIVE_OVERLAY_SETTINGS,
  filterLiveItems,
  LIVE_LIMITS,
  LIVE_SETTINGS_STORAGE_KEY,
  normalizeLiveOverlaySettings,
  uniqueLiveOptions,
  type LiveOverlaySettings
} from "@/lib/live-overlay";
import {
  categoryLabels,
  SHOP_CATEGORIES,
  type ShopCategory
} from "@/lib/shop";

const controlClass =
  "h-11 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none ring-cyan-300/30 transition focus:ring-4";
const labelClass = "text-xs font-black uppercase text-slate-300";

function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className={labelClass}>{label}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-3">
        <input
          aria-label={`${label} slider`}
          className="accent-cyan-300"
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="range"
          value={value}
        />
        <div className="relative">
          <input
            aria-label={label}
            className={`${controlClass} pr-12`}
            max={max}
            min={min}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) {
                onChange(Math.min(Math.max(next, min), max));
              }
            }}
            step={step}
            type="number"
            value={value}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
            {suffix}
          </span>
        </div>
      </div>
    </label>
  );
}

export function LiveOverlayBuilder() {
  const { payload, isRetrying } = useLiveShopData();
  const [settings, setSettings] = useState<LiveOverlaySettings>(DEFAULT_LIVE_OVERLAY_SETTINGS);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isPreviewPaused, setIsPreviewPaused] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const [hasRestoredSettings, setHasRestoredSettings] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const items = payload?.items ?? [];

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const saved = window.localStorage.getItem(LIVE_SETTINGS_STORAGE_KEY);
      if (saved) {
        setSettings(normalizeLiveOverlaySettings(JSON.parse(saved)));
      }
    } catch {
      // The editor remains fully usable without persisted convenience settings.
    } finally {
      setHasRestoredSettings(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRestoredSettings) {
      return;
    }

    try {
      window.localStorage.setItem(LIVE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Browser storage is optional; the generated URL remains authoritative.
    }
  }, [hasRestoredSettings, settings]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!categoryMenuRef.current?.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    }

    if (isCategoryMenuOpen) {
      document.addEventListener("pointerdown", handlePointerDown);
    }

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isCategoryMenuOpen]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<ShopCategory, number>(SHOP_CATEGORIES.map((category) => [category, 0]));
    items.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));
    return counts;
  }, [items]);
  const rarityOptions = useMemo(() => uniqueLiveOptions(items.map((item) => item.rarity)), [items]);
  const seasonOptions = useMemo(() => uniqueLiveOptions(items.map((item) => item.season)), [items]);
  const matchingItems = useMemo(() => filterLiveItems(items, settings), [items, settings]);
  const overlayPath = useMemo(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    return `${basePath}/live/overlay/?${buildLiveOverlaySearch(settings).toString()}`;
  }, [settings]);
  const absoluteOverlayUrl = useMemo(
    () => (origin ? new URL(overlayPath, origin).toString() : overlayPath),
    [origin, overlayPath]
  );
  const directionOptions =
    settings.orientation === "horizontal"
      ? (["left", "right"] as const)
      : (["up", "down"] as const);

  function updateSettings(patch: Partial<LiveOverlaySettings>) {
    setSettings((current) => normalizeLiveOverlaySettings({ ...current, ...patch }));
    setCopyMessage("");
  }

  function toggleCategory(category: ShopCategory) {
    const selected = new Set(settings.categories);
    if (selected.has(category)) {
      selected.delete(category);
    } else {
      selected.add(category);
    }

    updateSettings({ categories: SHOP_CATEGORIES.filter((candidate) => selected.has(candidate)) });
  }

  function toggleAllCategories() {
    updateSettings({
      categories: settings.categories.length === SHOP_CATEGORIES.length ? [] : [...SHOP_CATEGORIES]
    });
  }

  function setOrientation(orientation: LiveOverlaySettings["orientation"]) {
    const isReverse = settings.direction === "down" || settings.direction === "right";
    updateSettings({
      orientation,
      direction: orientation === "horizontal" ? (isReverse ? "right" : "left") : (isReverse ? "down" : "up")
    });
  }

  function useImageOnlyPreset() {
    updateSettings({
      showImage: true,
      showName: false,
      showMeta: false,
      showVbucks: false,
      showBirr: false,
      showDescription: false,
      background: "transparent"
    });
  }

  async function copyOverlayUrl() {
    try {
      await window.navigator.clipboard.writeText(absoluteOverlayUrl);
      setCopyMessage("TikTok Live link copied.");
    } catch {
      setCopyMessage("Could not copy automatically. Open the overlay and copy its address.");
    }
  }

  return (
    <main className="min-h-screen bg-[#05070d] text-white">
      <header className="border-b border-white/10 bg-[linear-gradient(180deg,#07111f,#05070d)] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase text-cyan-200">Livestream workspace</p>
            <h1 className="text-2xl font-black sm:text-3xl">Fortnite Item Shop Live Overlay</h1>
          </div>
          <Link
            className="rounded-md border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.1]"
            href="/"
            prefetch={false}
          >
            Screenshot Generator
          </Link>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-90px)] xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
        <div className="min-w-0 border-white/10 xl:border-r">
          <section className="border-b border-white/10 p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-cyan-200">Shop selection</p>
                <h2 className="text-lg font-black">Choose what enters the stream</h2>
              </div>
              <strong className="rounded-md bg-cyan-300 px-3 py-1.5 text-sm text-slate-950" data-testid="live-match-count">
                {matchingItems.length} matching
              </strong>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2">
                <span className={labelClass}>Categories</span>
                <div className="relative" ref={categoryMenuRef}>
                  <button
                    aria-label="Select live overlay categories"
                    className={`${controlClass} flex items-center justify-between gap-3 text-left`}
                    data-testid="live-category-select"
                    onClick={() => setIsCategoryMenuOpen((current) => !current)}
                    type="button"
                  >
                    <span className="truncate">
                      {settings.categories.length === 0
                        ? "No categories selected"
                        : settings.categories.length === SHOP_CATEGORIES.length
                          ? "All categories"
                          : `${settings.categories.length} selected`}
                    </span>
                    <span aria-hidden="true" className="text-cyan-200">v</span>
                  </button>

                  {isCategoryMenuOpen ? (
                    <div className="absolute left-0 right-0 z-40 mt-2 max-h-[26rem] overflow-auto rounded-md border border-white/10 bg-slate-950 p-2 shadow-2xl">
                      <button
                        className="mb-2 h-9 w-full rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950"
                        onClick={toggleAllCategories}
                        type="button"
                      >
                        {settings.categories.length === SHOP_CATEGORIES.length ? "Unmark all" : "Mark all"}
                      </button>
                      {SHOP_CATEGORIES.map((category) => (
                        <label
                          className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded px-2 text-sm font-bold hover:bg-white/[0.06]"
                          key={category}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              checked={settings.categories.includes(category)}
                              onChange={() => toggleCategory(category)}
                              type="checkbox"
                            />
                            {categoryLabels[category]}
                          </span>
                          <span className="text-xs text-slate-400">{categoryCounts.get(category) ?? 0}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <label className="grid gap-2">
                <span className={labelClass}>Name or type</span>
                <input
                  className={controlClass}
                  data-testid="live-name-filter"
                  onChange={(event) => updateSettings({ nameFilter: event.target.value })}
                  placeholder="Outfit, emote, pickaxe..."
                  type="search"
                  value={settings.nameFilter}
                />
              </label>

              <label className="grid gap-2">
                <span className={labelClass}>Rarity</span>
                <select
                  className={controlClass}
                  data-testid="live-rarity-filter"
                  onChange={(event) => updateSettings({ rarityFilter: event.target.value })}
                  value={settings.rarityFilter}
                >
                  <option value="all">All rarities</option>
                  {rarityOptions.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                </select>
              </label>

              <label className="grid gap-2">
                <span className={labelClass}>Season</span>
                <select
                  className={controlClass}
                  data-testid="live-season-filter"
                  onChange={(event) => updateSettings({ seasonFilter: event.target.value })}
                  value={settings.seasonFilter}
                >
                  <option value="all">All seasons</option>
                  {seasonOptions.map((season) => <option key={season} value={season}>{season}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="border-b border-white/10 p-4 sm:p-6">
            <p className="mb-4 text-xs font-black uppercase text-cyan-200">Item content</p>
            <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
              <label className="grid gap-2">
                <span className={labelClass}>Birr per V-Buck</span>
                <input
                  className={controlClass}
                  data-testid="live-birr-rate"
                  max={LIVE_LIMITS.birrRate.max}
                  min={LIVE_LIMITS.birrRate.min}
                  onChange={(event) => updateSettings({ birrRate: Number(event.target.value) })}
                  step="0.01"
                  type="number"
                  value={settings.birrRate}
                />
              </label>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={labelClass}>Visible elements</span>
                  <button
                    className="h-8 rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950"
                    data-testid="live-image-only"
                    onClick={useImageOnlyPreset}
                    type="button"
                  >
                    Image only
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {([
                    ["showImage", "Item image"],
                    ["showName", "Name"],
                    ["showMeta", "Type & rarity"],
                    ["showVbucks", "V-Bucks"],
                    ["showBirr", "Birr"],
                    ["showDescription", "Description"]
                  ] as const).map(([field, label]) => (
                    <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs font-black sm:text-sm" key={field}>
                      <input
                        checked={settings[field]}
                        data-testid={`live-${field}`}
                        onChange={(event) => updateSettings({ [field]: event.target.checked })}
                        type="checkbox"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="border-b border-white/10 p-4 sm:p-6">
            <p className="mb-4 text-xs font-black uppercase text-cyan-200">Motion and layout</p>
            <div className="grid gap-5 lg:grid-cols-2">
              <fieldset className="grid gap-2">
                <legend className={labelClass}>Orientation</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["vertical", "horizontal"] as const).map((orientation) => (
                    <button
                      aria-pressed={settings.orientation === orientation}
                      className={`h-11 rounded-md border text-sm font-black capitalize ${settings.orientation === orientation ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/[0.04] text-white"}`}
                      data-testid={`live-orientation-${orientation}`}
                      key={orientation}
                      onClick={() => setOrientation(orientation)}
                      type="button"
                    >
                      {orientation}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="grid gap-2">
                <legend className={labelClass}>Direction</legend>
                <div className="grid grid-cols-2 gap-2">
                  {directionOptions.map((direction) => (
                    <button
                      aria-pressed={settings.direction === direction}
                      className={`h-11 rounded-md border text-sm font-black capitalize ${settings.direction === direction ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/[0.04] text-white"}`}
                      data-testid={`live-direction-${direction}`}
                      key={direction}
                      onClick={() => updateSettings({ direction })}
                      type="button"
                    >
                      {direction}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="grid gap-2">
                <legend className={labelClass}>Item background</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["transparent", "Transparent"],
                    ["solid", "Solid"],
                    ["rarity", "Rarity"],
                    ["shop", "Fortnite Shop"]
                  ] as const).map(([background, label]) => (
                    <button
                      aria-pressed={settings.background === background}
                      className={`min-h-11 rounded-md border px-2 py-2 text-sm font-black ${settings.background === background ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/[0.04] text-white"}`}
                      data-testid={`live-background-${background}`}
                      key={background}
                      onClick={() => updateSettings({ background })}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <NumberControl label="Speed" max={LIVE_LIMITS.speed.max} min={LIVE_LIMITS.speed.min} onChange={(speed) => updateSettings({ speed })} suffix="px/s" value={settings.speed} />
              <NumberControl label="Card gap" max={LIVE_LIMITS.gap.max} min={LIVE_LIMITS.gap.min} onChange={(gap) => updateSettings({ gap })} suffix="px" value={settings.gap} />
              <div className="lg:col-span-2">
                <NumberControl label="Card width" max={LIVE_LIMITS.cardWidth.max} min={LIVE_LIMITS.cardWidth.min} onChange={(cardWidth) => updateSettings({ cardWidth })} suffix="px" value={settings.cardWidth} />
              </div>
            </div>
          </section>

          <section className="p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="h-12 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
                data-testid="copy-live-link"
                disabled={!origin || matchingItems.length === 0}
                onClick={copyOverlayUrl}
                type="button"
              >
                Copy TikTok Live Link
              </button>
              <a
                className="grid h-12 place-items-center rounded-md border border-white/15 bg-white/[0.06] px-4 text-sm font-black text-white transition hover:bg-white/[0.1]"
                data-testid="open-live-overlay"
                href={overlayPath}
                rel="noreferrer"
                target="_blank"
              >
                Open Live Overlay
              </a>
            </div>
            <p
              className={`mt-3 min-h-5 text-sm ${copyMessage.startsWith("Could") ? "text-red-200" : "text-emerald-200"}`}
              role="status"
            >
              {copyMessage || (isRetrying ? "Using the last shop data while retrying refresh." : "")}
            </p>
            <output className="mt-2 block break-all rounded-md bg-black/35 p-3 text-xs text-slate-400" data-testid="generated-live-url">
              {absoluteOverlayUrl}
            </output>
          </section>
        </div>

        <aside className="min-w-0 bg-[#03060b] p-4 sm:p-6 xl:sticky xl:top-0 xl:h-screen">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-cyan-200">Live preview</p>
              <p className="text-sm text-slate-400">Windowed stream output</p>
            </div>
            <button
              className="h-10 rounded-md border border-white/15 bg-white/[0.06] px-4 text-sm font-black"
              onClick={() => setIsPreviewPaused((current) => !current)}
              type="button"
            >
              {isPreviewPaused ? "Resume" : "Pause"}
            </button>
          </div>
          <div className="live-preview-frame h-[640px] overflow-hidden rounded-md border border-white/10 sm:h-[720px] xl:h-[calc(100vh-100px)]">
            <LiveOverlayView
              items={items}
              paused={isPreviewPaused}
              settings={settings}
              unavailable={!payload && isRetrying}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
