"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScreenshotCanvas } from "@/components/ScreenshotCanvas";
import {
  categoryLabels,
  groupShopItems,
  SHOP_CATEGORIES,
  type ShopCategory,
  type ShopPayload
} from "@/lib/shop";

type ShopGroup = ReturnType<typeof groupShopItems>[number];
type SplitCount = 1 | 2 | 3;

function splitGroups(groups: ShopGroup[], splitCount: SplitCount) {
  if (splitCount === 1) {
    return [groups];
  }

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const targetItemsPerPage = Math.ceil(totalItems / splitCount);
  const pages: ShopGroup[][] = [[]];
  let activePage = 0;
  let activePageCount = 0;

  for (const group of groups) {
    let start = 0;

    while (start < group.items.length) {
      if (activePageCount >= targetItemsPerPage && activePage < splitCount - 1) {
        activePage += 1;
        pages[activePage] = [];
        activePageCount = 0;
      }

      const capacity = Math.max(targetItemsPerPage - activePageCount, 1);
      const chunk = group.items.slice(start, start + capacity);
      pages[activePage].push({
        ...group,
        label: start > 0 ? `${group.label} continued` : group.label,
        items: chunk
      });

      start += chunk.length;
      activePageCount += chunk.length;
    }
  }

  return pages.filter((page) => page.length > 0);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

async function waitForImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll("img"));

  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalWidth > 0) {
        return Promise.resolve();
      }

      if (typeof image.decode === "function") {
        return image.decode().catch(() => undefined);
      }

      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    })
  );
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Loading...";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function ShopGenerator() {
  const [shop, setShop] = useState<ShopPayload | null>(null);
  const [error, setError] = useState("");
  const [birrPerVbuck, setBirrPerVbuck] = useState(1);
  const [isScreenshotMode, setIsScreenshotMode] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<ShopCategory[]>([...SHOP_CATEGORIES]);
  const [nameFilter, setNameFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [splitCount, setSplitCount] = useState<SplitCount>(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const splitRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    let mounted = true;

    fetch("/shop-data.json")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load today's shop.");
        }

        return response.json() as Promise<ShopPayload>;
      })
      .then((payload) => {
        if (mounted) {
          setShop(payload);
        }
      })
      .catch((reason: unknown) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : "Unable to load today's shop.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const rarityOptions = useMemo(() => uniqueSorted(shop?.items.map((item) => item.rarity) ?? []), [shop]);
  const seasonOptions = useMemo(() => uniqueSorted(shop?.items.map((item) => item.season) ?? []), [shop]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<ShopCategory, number>();

    for (const category of SHOP_CATEGORIES) {
      counts.set(category, 0);
    }

    for (const item of shop?.items ?? []) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }

    return counts;
  }, [shop]);

  const filteredItems = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();
    const selectedCategorySet = new Set(selectedCategories);

    return (shop?.items ?? []).filter((item) => {
      const matchesCategory = selectedCategorySet.has(item.category);
      const matchesName =
        !normalizedName ||
        item.name.toLowerCase().includes(normalizedName) ||
        item.type.toLowerCase().includes(normalizedName);
      const matchesRarity = rarityFilter === "all" || item.rarity === rarityFilter;
      const matchesSeason = seasonFilter === "all" || item.season === seasonFilter;

      return matchesCategory && matchesName && matchesRarity && matchesSeason;
    });
  }, [nameFilter, rarityFilter, seasonFilter, selectedCategories, shop]);

  const groups = useMemo(() => groupShopItems(filteredItems), [filteredItems]);
  const splitPages = useMemo(() => splitGroups(groups, splitCount), [groups, splitCount]);
  const totalShopCount = shop?.items.length ?? 0;
  const filteredCount = filteredItems.length;
  const totalVbucks = filteredItems.reduce((sum, item) => sum + item.price, 0);
  const categorySummary =
    selectedCategories.length === SHOP_CATEGORIES.length
      ? "All categories"
      : selectedCategories.map((category) => categoryLabels[category]).join(", ");
  const activeFilterLabel = [
    categorySummary,
    nameFilter.trim() ? `Name: ${nameFilter.trim()}` : "",
    rarityFilter !== "all" ? `Rarity: ${rarityFilter}` : "",
    seasonFilter !== "all" ? seasonFilter : ""
  ]
    .filter(Boolean)
    .join(" / ");

  function toggleCategory(category: ShopCategory) {
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        const next = current.filter((item) => item !== category);
        return next.length > 0 ? next : current;
      }

      return [...current, category];
    });
  }

  function selectOnlyCategory(category: ShopCategory) {
    setSelectedCategories([category]);
  }

  function resetFilters() {
    setSelectedCategories([...SHOP_CATEGORIES]);
    setNameFilter("");
    setRarityFilter("all");
    setSeasonFilter("all");
    setSplitCount(1);
  }

  async function captureNode(node: HTMLElement, filename: string) {
    const { toPng } = await import("html-to-image");

    await waitForImages(node);

    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 1.5,
      backgroundColor: "#020617"
    });

    downloadDataUrl(dataUrl, filename);
  }

  async function downloadPngs() {
    setIsDownloading(true);

    try {
      if (splitCount === 1 && canvasRef.current) {
        await captureNode(canvasRef.current, "fortnite-shop-shot-selected.png");
        return;
      }

      const nodes = splitRefs.current.filter((node): node is HTMLDivElement => Boolean(node));

      for (const [index, node] of nodes.entries()) {
        await captureNode(node, `fortnite-shop-shot-${index + 1}-of-${nodes.length}.png`);
      }
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),linear-gradient(180deg,#020617,#0f172a)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-normal text-cyan-200">
              Screenshot generator
            </p>
            <h1 className="text-4xl font-black leading-none tracking-normal sm:text-6xl">
              Fortnite Item Shop Shot
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Choose all categories or focus on skins, pickaxes, emotes, and more. The PNG
              export uses exactly the filtered shop view below.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300">Latest shop</span>
              <strong className="text-right text-sm text-white">{formatDateTime(shop?.updatedAt)}</strong>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-black/30 p-3">
                <span className="block text-xs text-slate-400">Showing</span>
                <strong>
                  {filteredCount}/{totalShopCount}
                </strong>
              </div>
              <div className="rounded-md bg-black/30 p-3">
                <span className="block text-xs text-slate-400">V-Bucks</span>
                <strong>{totalVbucks.toLocaleString()}</strong>
              </div>
              <div className="rounded-md bg-black/30 p-3">
                <span className="block text-xs text-slate-400">Birr</span>
                <strong>{Math.round(totalVbucks * birrPerVbuck).toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-lg border border-white/10 bg-white/[0.055] p-4 lg:sticky lg:top-4">
          <div className="grid gap-5">
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Screenshot categories
                </span>
                <button
                  className="rounded bg-cyan-300 px-2 py-1 text-xs font-black text-slate-950"
                  onClick={() => setSelectedCategories([...SHOP_CATEGORIES])}
                  type="button"
                >
                  All
                </button>
              </div>
              <div className="grid gap-2">
                {SHOP_CATEGORIES.map((category) => {
                  const isSelected = selectedCategories.includes(category);

                  return (
                    <div className="grid grid-cols-[1fr_64px] gap-2" key={category}>
                      <button
                        className={`min-h-10 rounded-md border px-3 text-left text-xs font-black transition ${
                          isSelected
                            ? "border-cyan-200 bg-cyan-300 text-slate-950"
                            : "border-white/10 bg-slate-950 text-slate-300"
                        }`}
                        data-testid={`category-toggle-${category}`}
                        onClick={() => toggleCategory(category)}
                        type="button"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>{categoryLabels[category]}</span>
                          <span>{categoryCounts.get(category) ?? 0}</span>
                        </span>
                      </button>
                      <button
                        className="min-h-10 rounded-md border border-white/10 bg-black/25 px-2 text-xs font-black text-amber-100"
                        data-testid={`category-only-${category}`}
                        onClick={() => selectOnlyCategory(category)}
                        type="button"
                      >
                        Only
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs leading-5 text-slate-400">
                Tap category names to include or remove them. Use Only to screenshot one category.
              </p>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Filter by name or type
                </span>
                <input
                  className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-white outline-none ring-cyan-300/30 focus:ring-4"
                  onChange={(event) => setNameFilter(event.target.value)}
                  placeholder="Outfit name, pickaxe, wrap..."
                  value={nameFilter}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Filter by rarity
                </span>
                <select
                  className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-white outline-none ring-cyan-300/30 focus:ring-4"
                  onChange={(event) => setRarityFilter(event.target.value)}
                  value={rarityFilter}
                >
                  <option value="all">All rarities</option>
                  {rarityOptions.map((rarity) => (
                    <option key={rarity} value={rarity}>
                      {rarity}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Filter by season
                </span>
                <select
                  className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-white outline-none ring-cyan-300/30 focus:ring-4"
                  onChange={(event) => setSeasonFilter(event.target.value)}
                  value={seasonFilter}
                >
                  <option value="all">All seasons</option>
                  {seasonOptions.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                V-Bucks-to-Birr rate
              </span>
              <input
                className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-white outline-none ring-cyan-300/30 focus:ring-4"
                min="0"
                onChange={(event) => setBirrPerVbuck(Number(event.target.value) || 0)}
                step="0.01"
                type="number"
                value={birrPerVbuck}
              />
              <span className="text-xs text-slate-400">Default: 1 V-Buck = 1 Birr.</span>
            </label>

            <div className="grid gap-3 rounded-md bg-black/25 p-3">
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-bold text-slate-200">Screenshot mode</span>
                <input
                  checked={isScreenshotMode}
                  className="h-5 w-5 accent-cyan-300"
                  onChange={(event) => setIsScreenshotMode(event.target.checked)}
                  type="checkbox"
                />
              </label>

              <div className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Split export
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((count) => (
                    <button
                      className={`h-10 rounded-md border text-sm font-black ${
                        splitCount === count
                          ? "border-amber-200 bg-amber-200 text-slate-950"
                          : "border-white/10 bg-slate-950 text-slate-300"
                      }`}
                      data-testid={`split-${count}`}
                      key={count}
                      onClick={() => setSplitCount(count as SplitCount)}
                      type="button"
                    >
                      {count} PNG
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <button
                className="h-11 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                data-testid="download-pngs"
                disabled={!shop || isDownloading || filteredCount === 0}
                onClick={downloadPngs}
                type="button"
              >
                {isDownloading
                  ? "Rendering..."
                  : `Download ${splitCount} PNG${splitCount > 1 ? " files" : ""}`}
              </button>
              <button
                className="h-10 rounded-md border border-white/10 bg-slate-950 px-4 text-sm font-bold text-slate-200"
                onClick={resetFilters}
                type="button"
              >
                Reset filters
              </button>
              <p className="text-xs leading-5 text-slate-400">
                The screenshot includes only the selected categories and filters.
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {error ? (
            <div className="rounded-lg border border-red-300/30 bg-red-950/50 p-4 text-red-100">{error}</div>
          ) : null}

          {!shop ? (
            <div className="grid gap-3">
              {Array.from({ length: 5 }, (_, index) => (
                <div className="h-32 animate-pulse rounded-lg bg-white/[0.06]" key={index} />
              ))}
            </div>
          ) : (
            <div
              className={
                isScreenshotMode
                  ? "max-w-full overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3"
                  : "max-w-full overflow-x-auto"
              }
            >
              <div data-testid="shop-canvas" ref={canvasRef}>
                <ScreenshotCanvas
                  activeFilterLabel={activeFilterLabel}
                  birrPerVbuck={birrPerVbuck}
                  groups={groups}
                  itemCount={filteredCount}
                  updatedAt={shop.updatedAt}
                />
              </div>
            </div>
          )}

          <div className="pointer-events-none fixed left-[-9999px] top-0 opacity-0">
            {splitPages.map((pageGroups, index) => (
              <div
                key={index}
                ref={(node) => {
                  splitRefs.current[index] = node;
                }}
              >
                <ScreenshotCanvas
                  activeFilterLabel={activeFilterLabel}
                  birrPerVbuck={birrPerVbuck}
                  groups={pageGroups}
                  itemCount={filteredCount}
                  pageNumber={index + 1}
                  pageTotal={splitPages.length}
                  updatedAt={shop?.updatedAt}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
