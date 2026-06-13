"use client";

import { useEffect, useMemo, useState } from "react";
import { ScreenshotCanvas } from "@/components/ScreenshotCanvas";
import {
  categoryLabels,
  groupShopItems,
  SHOP_CATEGORIES,
  type ShopCategory,
  type ShopPayload
} from "@/lib/shop";

type ShopGroup = ReturnType<typeof groupShopItems>[number];

const POSTER_WIDTH = 1080;
const POSTER_PADDING = 32;
const CARD_GAP = 10;
const CARD_HEIGHT = 244;
const CARD_IMAGE_HEIGHT = 132;
const POSTER_IMAGE_TIMEOUT = 12000;
const POSTER_IMAGE_CONCURRENCY = 16;
const MIN_EXPORT_COLUMNS = 2;
const MAX_EXPORT_COLUMNS = 6;
const MIN_EXPORT_ROWS = 1;
const MAX_EXPORT_ROWS = 30;
const posterImageCache = new Map<string, Promise<HTMLImageElement | null>>();

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function splitGroupsByCapacity(groups: ShopGroup[], itemsPerPage: number) {
  const pages: ShopGroup[][] = [[]];
  let activePage = 0;
  let activePageCount = 0;

  for (const group of groups) {
    let start = 0;

    while (start < group.items.length) {
      if (activePageCount >= itemsPerPage) {
        activePage += 1;
        pages[activePage] = [];
        activePageCount = 0;
      }

      const capacity = Math.max(itemsPerPage - activePageCount, 1);
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

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let activeLine = "";

  for (const word of words) {
    const testLine = activeLine ? `${activeLine} ${word}` : word;

    if (context.measureText(testLine).width <= maxWidth || !activeLine) {
      activeLine = testLine;
      continue;
    }

    lines.push(activeLine);
    activeLine = word;

    if (lines.length === maxLines) {
      break;
    }
  }

  if (activeLine && lines.length < maxLines) {
    lines.push(activeLine);
  }

  lines.slice(0, maxLines).forEach((line, index) => {
    const renderedLine =
      index === maxLines - 1 && lines.length === maxLines && words.join(" ") !== lines.join(" ")
        ? `${line.replace(/\W?\w*$/, "")}...`
        : line;
    context.fillText(renderedLine, x, y + index * lineHeight);
  });
}

function loadPosterImage(src: string) {
  const cachedImage = posterImageCache.get(src);

  if (cachedImage) {
    return cachedImage;
  }

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    let isDone = false;
    const image = new Image();
    const timeout = window.setTimeout(() => {
      if (!isDone) {
        isDone = true;
        resolve(null);
      }
    }, POSTER_IMAGE_TIMEOUT);

    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      if (!isDone) {
        isDone = true;
        window.clearTimeout(timeout);
        resolve(image);
      }
    };
    image.onerror = () => {
      if (!isDone) {
        isDone = true;
        window.clearTimeout(timeout);
        resolve(null);
      }
    };
    image.src = src;
  });

  posterImageCache.set(src, promise);

  return promise;
}

async function loadPosterImages(sources: string[]) {
  const images: (HTMLImageElement | null)[] = Array(sources.length).fill(null);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < sources.length) {
      const index = nextIndex;
      nextIndex += 1;
      images[index] = await loadPosterImage(sources[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(POSTER_IMAGE_CONCURRENCY, sources.length) }, () => worker())
  );

  return images;
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const renderedX = x + (width - renderedWidth) / 2;
  const renderedY = y + (height - renderedHeight) / 2;

  context.drawImage(image, renderedX, renderedY, renderedWidth, renderedHeight);
}

function drawImageFallback(context: CanvasRenderingContext2D, itemName: string, x: number, y: number, width: number, height: number) {
  const initials = itemName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  context.save();
  context.fillStyle = "#111827";
  context.fillRect(x, y, width, height);
  context.strokeStyle = "rgba(125, 211, 252, 0.22)";
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  context.fillStyle = "#67e8f9";
  context.font = "900 30px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(initials || "ITEM", x + width / 2, y + height / 2 - 8);
  context.fillStyle = "#94a3b8";
  context.font = "800 9px Arial, sans-serif";
  context.fillText("ITEM ART", x + width / 2, y + height / 2 + 22);
  context.restore();
}

export function ShopGenerator() {
  const [shop, setShop] = useState<ShopPayload | null>(null);
  const [error, setError] = useState("");
  const [birrPerVbuck, setBirrPerVbuck] = useState(1);
  const [isScreenshotMode, setIsScreenshotMode] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<ShopCategory[]>(["skins"]);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [exportColumns, setExportColumns] = useState(4);
  const [exportRows, setExportRows] = useState(6);

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
  const itemsPerPng = exportColumns * exportRows;
  const splitPages = useMemo(() => splitGroupsByCapacity(groups, itemsPerPng), [groups, itemsPerPng]);
  const totalShopCount = shop?.items.length ?? 0;
  const filteredCount = filteredItems.length;
  const totalVbucks = filteredItems.reduce((sum, item) => sum + item.price, 0);
  const visibleCategorySummary = groups.map((group) => group.label).join(", ");
  const categorySummary =
    selectedCategories.length === SHOP_CATEGORIES.length
      ? "All categories"
      : visibleCategorySummary || selectedCategories.map((category) => categoryLabels[category]).join(", ");
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
    setExportColumns(4);
    setExportRows(6);
    setDownloadMessage("");
  }

  async function captureGroups(groupsToCapture: ShopGroup[], filename: string, pageNumber?: number, pageTotal?: number) {
    const cardWidth =
      (POSTER_WIDTH - POSTER_PADDING * 2 - 36 - CARD_GAP * (exportColumns - 1)) / exportColumns;
    const rows = groupsToCapture.reduce(
      (sum, group) => sum + Math.ceil(group.items.length / exportColumns),
      0
    );
    const posterHeight =
      POSTER_PADDING * 2 +
      groupsToCapture.length * 52 +
      rows * CARD_HEIGHT +
      Math.max(rows - groupsToCapture.length, 0) * CARD_GAP;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not supported in this browser.");
    }

    canvas.width = POSTER_WIDTH;
    canvas.height = Math.max(320, posterHeight);

    const background = context.createLinearGradient(0, 0, POSTER_WIDTH, canvas.height);
    background.addColorStop(0, "#020617");
    background.addColorStop(0.55, "#101827");
    background.addColorStop(1, "#171717");
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    let y = POSTER_PADDING;

    for (const group of groupsToCapture) {
      const sectionRows = Math.ceil(group.items.length / exportColumns);
      const sectionHeight = 38 + sectionRows * CARD_HEIGHT + Math.max(sectionRows - 1, 0) * CARD_GAP + 14;

      roundedRect(context, POSTER_PADDING, y, POSTER_WIDTH - POSTER_PADDING * 2, sectionHeight, 10);
      context.fillStyle = "rgba(255,255,255,0.045)";
      context.fill();
      context.strokeStyle = "rgba(255,255,255,0.1)";
      context.stroke();

      context.fillStyle = "#67e8f9";
      context.font = "900 20px Arial, sans-serif";
      context.fillText(group.label.toUpperCase(), POSTER_PADDING + 18, y + 28);
      context.fillStyle = "#e2e8f0";
      context.font = "800 14px Arial, sans-serif";
      context.textAlign = "right";
      context.fillText(
        `${group.items.length.toLocaleString()} item${group.items.length === 1 ? "" : "s"}${pageNumber ? ` - ${pageNumber}/${pageTotal}` : ""}`,
        POSTER_WIDTH - POSTER_PADDING - 18,
        y + 28
      );
      context.textAlign = "left";

      const images = await loadPosterImages(group.items.map((item) => item.image));

      group.items.forEach((item, index) => {
        const column = index % exportColumns;
        const row = Math.floor(index / exportColumns);
        const x = POSTER_PADDING + 18 + column * (cardWidth + CARD_GAP);
        const cardY = y + 42 + row * (CARD_HEIGHT + CARD_GAP);

        roundedRect(context, x, cardY, cardWidth, CARD_HEIGHT, 8);
        context.fillStyle = "rgba(2,6,23,0.78)";
        context.fill();
        context.strokeStyle = "rgba(255,255,255,0.10)";
        context.stroke();

        roundedRect(context, x + 8, cardY + 8, cardWidth - 16, CARD_IMAGE_HEIGHT, 8);
        const imageBackground = context.createLinearGradient(x, cardY, x + cardWidth, cardY + CARD_IMAGE_HEIGHT);
        imageBackground.addColorStop(0, "#0f172a");
        imageBackground.addColorStop(1, "#111827");
        context.fillStyle = imageBackground;
        context.fill();

        const image = images[index];
        if (image) {
          drawContainedImage(context, image, x + 12, cardY + 12, cardWidth - 24, CARD_IMAGE_HEIGHT - 8);
        } else {
          drawImageFallback(context, item.name, x + 12, cardY + 12, cardWidth - 24, CARD_IMAGE_HEIGHT - 8);
        }

        roundedRect(context, x + 12, cardY + 12, Math.min(context.measureText(item.rarity).width + 18, cardWidth - 24), 20, 4);
        context.fillStyle = "rgba(0,0,0,0.62)";
        context.fill();
        context.fillStyle = "#cffafe";
        context.font = "900 10px Arial, sans-serif";
        context.fillText(item.rarity.toUpperCase(), x + 20, cardY + 26, cardWidth - 34);

        context.fillStyle = "#94a3b8";
        context.font = "800 10px Arial, sans-serif";
        context.fillText(item.type.toUpperCase(), x + 10, cardY + 160, cardWidth - 20);
        context.fillStyle = "#ffffff";
        context.font = "900 15px Arial, sans-serif";
        drawText(context, item.name, x + 10, cardY + 181, cardWidth - 20, 17, 2);
        context.fillStyle = "#94a3b8";
        context.font = "700 10px Arial, sans-serif";
        drawText(context, item.season, x + 10, cardY + 218, cardWidth - 20, 12, 1);

        context.fillStyle = "#bae6fd";
        context.font = "900 13px Arial, sans-serif";
        context.fillText(`${item.price.toLocaleString()} V-Bucks`, x + 10, cardY + 236);
        context.fillStyle = "#fde68a";
        context.textAlign = "right";
        context.fillText(`${Math.round(item.price * birrPerVbuck).toLocaleString()} Birr`, x + cardWidth - 10, cardY + 236);
        context.textAlign = "left";
      });

      y += sectionHeight + 14;
    }

    const dataUrl = canvas.toDataURL("image/png");
    downloadDataUrl(dataUrl, filename);
  }

  async function downloadPngs() {
    setIsDownloading(true);
    setDownloadMessage("Preparing your PNG...");

    try {
      if (splitPages.length === 1) {
        await captureGroups(splitPages[0] ?? groups, "fortnite-items-selected.png");
        setDownloadMessage("PNG generated. Check your downloads or file manager.");
        return;
      }

      for (const [index, pageGroups] of splitPages.entries()) {
        await captureGroups(pageGroups, `fortnite-items-${index + 1}-of-${splitPages.length}.png`, index + 1, splitPages.length);
      }
      setDownloadMessage(`${splitPages.length} PNG files generated. Check your downloads or file manager.`);
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
    <main className="min-h-screen bg-[#05070d] text-white">
      <section className="border-b border-white/10 bg-[linear-gradient(180deg,#07111f,#05070d)] px-3 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-normal text-cyan-200">
              Item screenshot workspace
            </p>
            <h1 className="text-2xl font-black tracking-normal sm:text-3xl">
              Fortnite Item Shop Generator
            </h1>
          </div>

          <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.05] p-3 shadow-xl shadow-black/20 sm:min-w-[420px]">
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

      <section className="grid min-h-[calc(100vh-108px)] gap-0 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="border-b border-white/10 bg-[#08101d]/95 p-3 shadow-2xl shadow-black/20 backdrop-blur xl:sticky xl:top-0 xl:h-[calc(100vh-108px)] xl:overflow-y-auto xl:border-b-0 xl:border-r">
          <div className="grid gap-4">
            <div className="grid gap-3">
              <label className="grid gap-2">
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

              <label className="grid gap-2">
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

              <label className="grid gap-2">
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

              <label className="grid gap-2">
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

              <div className="grid grid-cols-3 gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                    Columns
                  </span>
                  <input
                    className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none ring-cyan-300/30 focus:ring-4"
                    data-testid="export-columns"
                    max={MAX_EXPORT_COLUMNS}
                    min={MIN_EXPORT_COLUMNS}
                    onChange={(event) =>
                      setExportColumns(clampNumber(Number(event.target.value) || MIN_EXPORT_COLUMNS, MIN_EXPORT_COLUMNS, MAX_EXPORT_COLUMNS))
                    }
                    type="number"
                    value={exportColumns}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                    Rows
                  </span>
                  <input
                    className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none ring-cyan-300/30 focus:ring-4"
                    data-testid="export-rows"
                    max={MAX_EXPORT_ROWS}
                    min={MIN_EXPORT_ROWS}
                    onChange={(event) =>
                      setExportRows(clampNumber(Number(event.target.value) || MIN_EXPORT_ROWS, MIN_EXPORT_ROWS, MAX_EXPORT_ROWS))
                    }
                    type="number"
                    value={exportRows}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                    Birr rate
                  </span>
                  <input
                    className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none ring-cyan-300/30 focus:ring-4"
                    min="0"
                    onChange={(event) => setBirrPerVbuck(Number(event.target.value) || 0)}
                    step="0.01"
                    type="number"
                    value={birrPerVbuck}
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="flex min-h-10 items-center gap-3 rounded-md border border-white/10 bg-black/25 px-3">
                  <input
                    checked={isScreenshotMode}
                    className="h-5 w-5 accent-cyan-300"
                    onChange={(event) => setIsScreenshotMode(event.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-sm font-bold text-slate-200">Screenshot preview</span>
                </label>

                <button
                  className="h-10 rounded-md border border-white/10 bg-slate-950 px-4 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                  onClick={resetFilters}
                  type="button"
                >
                  Reset
                </button>
              </div>

              <button
                className="h-12 rounded-md bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                data-testid="download-pngs"
                disabled={!shop || isDownloading || filteredCount === 0}
                onClick={downloadPngs}
                type="button"
              >
                {isDownloading
                  ? "Rendering..."
                  : `Download ${splitPages.length} PNG${splitPages.length > 1 ? " files" : ""}`}
              </button>
            </div>

            <div className="grid gap-2 rounded-lg bg-black/20 p-3 text-sm text-slate-300 sm:flex sm:items-center sm:justify-between">
              <span>
                Showing <strong className="text-white">{filteredCount}</strong> of{" "}
                <strong className="text-white">{totalShopCount}</strong> items for{" "}
                <strong className="text-cyan-200">{categorySummary}</strong>.
                <span className="block pt-1 text-xs text-slate-400">
                  Layout: {exportColumns} columns x {exportRows} rows per PNG, {itemsPerPng} items per file.
                </span>
              </span>
              <span className={downloadMessage.includes("failed") ? "text-red-200" : "text-amber-100"}>
                {downloadMessage || "Downloads save to your browser downloads/file manager."}
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0 bg-[#05070d] p-3 sm:p-5">
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
                  ? "min-h-full rounded-lg border border-white/10 bg-black/35 p-2 shadow-2xl shadow-black/30"
                  : "min-h-full"
              }
            >
              <div data-testid="shop-canvas">
                <ScreenshotCanvas
                  birrPerVbuck={birrPerVbuck}
                  columns={exportColumns}
                  groups={groups}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
