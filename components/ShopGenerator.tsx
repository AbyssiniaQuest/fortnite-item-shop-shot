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

      const timeout = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 12000);
      });

      if (typeof image.decode === "function") {
        return Promise.race([image.decode().catch(() => undefined), timeout]);
      }

      const imageEvent = new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });

      return Promise.race([imageEvent, timeout]);
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
  const [downloadMessage, setDownloadMessage] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<ShopCategory[]>([...SHOP_CATEGORIES]);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [splitCount, setSplitCount] = useState<SplitCount>(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const splitRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    let mounted = true;

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/shop-data.json`)
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
  const visibleCategorySummary = groups.map((group) => group.label).join(", ");
  const categorySummary =
    selectedCategories.length === SHOP_CATEGORIES.length
      ? "All categories"
      : visibleCategorySummary || selectedCategories.map((category) => categoryLabels[category]).join(", ");
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
        const next = current.filter((selectedCategory) => selectedCategory !== category);
        return next.length > 0 ? next : current;
      }

      return [...current, category];
    });
  }

  function selectAllCategories() {
    setSelectedCategories([...SHOP_CATEGORIES]);
  }

  function clearCategorySelection() {
    setSelectedCategories(["skins"]);
  }

  function resetFilters() {
    selectAllCategories();
    setNameFilter("");
    setRarityFilter("all");
    setSeasonFilter("all");
    setSplitCount(1);
    setDownloadMessage("");
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
    setDownloadMessage("Preparing your PNG...");

    try {
      if (splitCount === 1 && canvasRef.current) {
        await captureNode(canvasRef.current, "fortnite-shop-shot-selected.png");
        setDownloadMessage("PNG generated. Check your downloads or file manager.");
        return;
      }

      const nodes = splitRefs.current.filter((node): node is HTMLDivElement => Boolean(node));

      for (const [index, node] of nodes.entries()) {
        await captureNode(node, `fortnite-shop-shot-${index + 1}-of-${nodes.length}.png`);
      }
      setDownloadMessage(`${nodes.length} PNG files generated. Check your downloads or file manager.`);
    } catch (reason) {
      setDownloadMessage(
        reason instanceof Error
          ? `PNG export failed: ${reason.message}`
          : "PNG export failed. Please try again."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(180deg,#020617,#0f172a)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[1fr_420px] xl:items-end">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-normal text-cyan-200">
              Screenshot generator
            </p>
            <h1 className="max-w-4xl text-4xl font-black leading-none tracking-normal sm:text-6xl">
              Fortnite Item Shop Shot
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Build a clean screenshot from the current shop. Choose a category, filter the
              results, then download one, two, or three PNG files.
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

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid min-w-[210px] flex-1 gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Screenshot categories
                </span>
                <div className="relative">
                  <button
                    className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-950 px-3 text-left text-sm font-bold text-white outline-none ring-cyan-300/30 transition hover:bg-white/[0.06] focus:ring-4"
                    data-testid="category-select"
                    onClick={() => setIsCategoryMenuOpen((isOpen) => !isOpen)}
                    type="button"
                  >
                    <span className="truncate">
                      {selectedCategories.length === SHOP_CATEGORIES.length
                        ? `All categories (${totalShopCount})`
                        : `${selectedCategories.length} selected`}
                    </span>
                    <span aria-hidden="true" className="text-cyan-200">
                      v
                    </span>
                  </button>

                  {isCategoryMenuOpen ? (
                    <div className="absolute left-0 right-0 z-30 mt-2 max-h-96 overflow-auto rounded-lg border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-black/50">
                      <div className="mb-2 grid grid-cols-2 gap-2">
                        <button
                          className="h-9 rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950"
                          onClick={selectAllCategories}
                          type="button"
                        >
                          Select all
                        </button>
                        <button
                          className="h-9 rounded-md border border-white/10 bg-black/30 px-3 text-xs font-black text-slate-200"
                          onClick={clearCategorySelection}
                          type="button"
                        >
                          Skins only
                        </button>
                      </div>

                      <div className="grid gap-1">
                        {SHOP_CATEGORIES.map((category) => {
                          const isSelected = selectedCategories.includes(category);

                          return (
                            <label
                              className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-sm font-bold text-slate-100 hover:bg-white/[0.06]"
                              key={category}
                            >
                              <span className="flex items-center gap-3">
                                <input
                                  checked={isSelected}
                                  className="h-4 w-4 accent-cyan-300"
                                  data-testid={`category-check-${category}`}
                                  onChange={() => toggleCategory(category)}
                                  type="checkbox"
                                />
                                <span>{categoryLabels[category]}</span>
                              </span>
                              <span className="text-xs text-slate-400">{categoryCounts.get(category) ?? 0}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </label>

              <label className="grid min-w-[220px] flex-[1.4] gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Filter by name or type
                </span>
                <input
                  className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none ring-cyan-300/30 focus:ring-4"
                  onChange={(event) => setNameFilter(event.target.value)}
                  placeholder="Outfit name, pickaxe, wrap..."
                  value={nameFilter}
                />
              </label>

              <label className="grid min-w-[170px] flex-1 gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Rarity
                </span>
                <select
                  className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none ring-cyan-300/30 focus:ring-4"
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

              <label className="grid min-w-[220px] flex-[1.2] gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Season
                </span>
                <select
                  className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none ring-cyan-300/30 focus:ring-4"
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

              <label className="grid min-w-[150px] gap-2">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Birr rate
                </span>
                <input
                  className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none ring-cyan-300/30 focus:ring-4"
                  min="0"
                  onChange={(event) => setBirrPerVbuck(Number(event.target.value) || 0)}
                  step="0.01"
                  type="number"
                  value={birrPerVbuck}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-10 items-center gap-3 rounded-md border border-white/10 bg-black/25 px-3">
                  <input
                    checked={isScreenshotMode}
                    className="h-5 w-5 accent-cyan-300"
                    onChange={(event) => setIsScreenshotMode(event.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-sm font-bold text-slate-200">Screenshot preview</span>
                </label>

                <div className="flex rounded-md border border-white/10 bg-slate-950 p-1">
                  {[1, 2, 3].map((count) => (
                    <button
                      className={`h-9 min-w-16 rounded px-3 text-sm font-black transition ${
                        splitCount === count ? "bg-amber-200 text-slate-950" : "text-slate-300 hover:bg-white/10"
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

                <button
                  className="h-10 rounded-md border border-white/10 bg-slate-950 px-4 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                  onClick={resetFilters}
                  type="button"
                >
                  Reset
                </button>
              </div>

              <button
                className="h-11 rounded-md bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                data-testid="download-pngs"
                disabled={!shop || isDownloading || filteredCount === 0}
                onClick={downloadPngs}
                type="button"
              >
                {isDownloading
                  ? "Rendering..."
                  : `Download ${splitCount} PNG${splitCount > 1 ? " files" : ""}`}
              </button>
            </div>

            <div className="grid gap-2 rounded-lg bg-black/20 p-3 text-sm text-slate-300 sm:flex sm:items-center sm:justify-between">
              <span>
                Showing <strong className="text-white">{filteredCount}</strong> of{" "}
                <strong className="text-white">{totalShopCount}</strong> items for{" "}
                <strong className="text-cyan-200">{categorySummary}</strong>.
              </span>
              <span className={downloadMessage.includes("failed") ? "text-red-200" : "text-amber-100"}>
                {downloadMessage || "Downloads save to your browser downloads/file manager."}
              </span>
            </div>
          </div>
        </div>

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
