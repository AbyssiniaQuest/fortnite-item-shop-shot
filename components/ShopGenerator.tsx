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
export type ScreenshotFields = {
  birr: boolean;
  vbucks: boolean;
  description: boolean;
};

type AutoPostSettings = {
  enabled: boolean;
  intervalDays: number;
  caption: string;
};

const POSTER_WIDTH = 1080;
const POSTER_PADDING = 18;
const SECTION_INSET = 10;
const CARD_GAP = 6;
const CARD_HEIGHT = 244;
const CARD_IMAGE_HEIGHT = 132;
const EXPORT_PIXEL_SCALE = 2;
const MAX_CANVAS_DIMENSION = 30000;
const POSTER_IMAGE_TIMEOUT = 12000;
const POSTER_IMAGE_CONCURRENCY = 16;
const MIN_EXPORT_COLUMNS = 2;
const MAX_EXPORT_COLUMNS = 20;
const DESKTOP_DEFAULT_COLUMNS = 8;
const MOBILE_DEFAULT_COLUMNS = 4;
const DEFAULT_AUTO_POST_CAPTION = "Today's item shop {date} 🔥";
const AUTO_POST_ISSUE_URL = "https://github.com/AbyssiniaQuest/fortnite-item-shop-shot/issues/new";
const posterImageCache = new Map<string, Promise<HTMLImageElement | null>>();

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDefaultColumnsForViewport() {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
    return MOBILE_DEFAULT_COLUMNS;
  }

  return DESKTOP_DEFAULT_COLUMNS;
}

async function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }

      reject(new Error("Unable to create PNG file."));
    }, "image/png");
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function formatAutoPostDate(date = new Date()) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function renderAutoPostCaption(caption: string) {
  return caption.replaceAll("{date}", formatAutoPostDate());
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
    const fillStyle = context.fillStyle;

    context.save();
    context.lineJoin = "round";
    context.lineWidth = 2;
    context.strokeStyle = "rgba(0,0,0,0.78)";
    context.strokeText(renderedLine, x, y + index * lineHeight, maxWidth);
    context.restore();
    context.fillStyle = fillStyle;
    context.fillText(renderedLine, x, y + index * lineHeight);
  });
}

function fillReadableText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth?: number
) {
  const fillStyle = context.fillStyle;

  context.save();
  context.lineJoin = "round";
  context.lineWidth = 2;
  context.strokeStyle = "rgba(0,0,0,0.78)";
  if (maxWidth) {
    context.strokeText(text, x, y, maxWidth);
  } else {
    context.strokeText(text, x, y);
  }
  context.restore();
  context.fillStyle = fillStyle;

  if (maxWidth) {
    context.fillText(text, x, y, maxWidth);
    return;
  }

  context.fillText(text, x, y);
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
  const [exportColumns, setExportColumns] = useState(DESKTOP_DEFAULT_COLUMNS);
  const [exportColumnInput, setExportColumnInput] = useState(String(DESKTOP_DEFAULT_COLUMNS));
  const [isEditingExportColumns, setIsEditingExportColumns] = useState(false);
  const [isPhoneLayout, setIsPhoneLayout] = useState(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [isAutoPostPanelOpen, setIsAutoPostPanelOpen] = useState(false);
  const [autoPostSettings, setAutoPostSettings] = useState<AutoPostSettings>({
    enabled: false,
    intervalDays: 1,
    caption: DEFAULT_AUTO_POST_CAPTION
  });
  const [screenshotFields, setScreenshotFields] = useState<ScreenshotFields>({
    birr: true,
    vbucks: true,
    description: false
  });
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    function syncPhoneLayout() {
      setIsPhoneLayout(mediaQuery.matches);
    }

    syncPhoneLayout();

    if (mediaQuery.matches) {
      setExportColumns(MOBILE_DEFAULT_COLUMNS);
    }

    mediaQuery.addEventListener("change", syncPhoneLayout);

    return () => {
      mediaQuery.removeEventListener("change", syncPhoneLayout);
    };
  }, []);

  useEffect(() => {
    if (!isEditingExportColumns) {
      setExportColumnInput(String(exportColumns));
    }
  }, [exportColumns, isEditingExportColumns]);

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

  useEffect(() => {
    let mounted = true;

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/auto-post-config.json`, {
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load auto-post settings.");
        }

        return response.json() as Promise<AutoPostSettings>;
      })
      .then((settings) => {
        if (mounted) {
          setAutoPostSettings({
            enabled: Boolean(settings.enabled),
            intervalDays: clampNumber(Number(settings.intervalDays) || 1, 1, 30),
            caption: settings.caption?.trim() || DEFAULT_AUTO_POST_CAPTION
          });
        }
      })
      .catch(() => {
        // The defaults keep the form usable before automation is configured.
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!categoryMenuRef.current?.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    }

    if (isCategoryMenuOpen) {
      document.addEventListener("pointerdown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isCategoryMenuOpen]);

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
  const totalShopCount = shop?.items.length ?? 0;
  const filteredCount = filteredItems.length;
  const totalVbucks = filteredItems.reduce((sum, item) => sum + item.price, 0);
  const visibleCategorySummary = groups.map((group) => group.label).join(", ");
  const categorySummary =
    selectedCategories.length === 0
      ? "No categories"
      : selectedCategories.length === SHOP_CATEGORIES.length
        ? "All categories"
        : visibleCategorySummary || selectedCategories.map((category) => categoryLabels[category]).join(", ");
  const isCompactExport = exportColumns >= 8 || isPhoneLayout;
  const isCompactPreview = isCompactExport;

  function toggleCategory(category: ShopCategory) {
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.filter((selectedCategory) => selectedCategory !== category);
      }

      return [...current, category];
    });
  }

  function toggleAllCategories() {
    setSelectedCategories((current) =>
      current.length === SHOP_CATEGORIES.length ? [] : [...SHOP_CATEGORIES]
    );
  }

  function resetFilters() {
    const defaultColumns = getDefaultColumnsForViewport();

    setSelectedCategories(["skins"]);
    setNameFilter("");
    setRarityFilter("all");
    setSeasonFilter("all");
    setExportColumns(defaultColumns);
    setExportColumnInput(String(defaultColumns));
    setScreenshotFields({
      birr: true,
      vbucks: true,
      description: false
    });
    setDownloadMessage("");
  }

  function toggleScreenshotField(field: keyof ScreenshotFields) {
    setScreenshotFields((current) => ({
      ...current,
      [field]: !current[field]
    }));
  }

  function openAutoPostSettingsIssue() {
    const safeCaption = autoPostSettings.caption
      .trim()
      .replaceAll("```", "'''") || DEFAULT_AUTO_POST_CAPTION;
    const issueBody = [
      "<!-- auto-post-settings -->",
      `Enabled: ${autoPostSettings.enabled}`,
      `Interval-Days: ${autoPostSettings.intervalDays}`,
      "Caption:",
      "```text",
      safeCaption,
      "```",
      "",
      "Submitting this issue applies these auto-post settings and closes the issue automatically."
    ].join("\n");
    const params = new URLSearchParams({
      title: "Configure auto-posting",
      body: issueBody
    });

    window.open(`${AUTO_POST_ISSUE_URL}?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  function handleExportColumnInput(value: string) {
    const numericValue = value.replace(/\D/g, "");

    setExportColumnInput(numericValue);

    if (!numericValue) {
      return;
    }

    const nextColumns = Number(numericValue);

    if (Number.isFinite(nextColumns) && nextColumns >= MIN_EXPORT_COLUMNS && nextColumns <= MAX_EXPORT_COLUMNS) {
      setExportColumns(nextColumns);
    }
  }

  function commitExportColumnInput() {
    const nextColumns = Number(exportColumnInput);
    const clampedColumns =
      Number.isFinite(nextColumns)
        ? clampNumber(nextColumns, MIN_EXPORT_COLUMNS, MAX_EXPORT_COLUMNS)
        : exportColumns;

    setIsEditingExportColumns(false);
    setExportColumns(clampedColumns);
    setExportColumnInput(String(clampedColumns));
  }

  async function captureGroups(groupsToCapture: ShopGroup[], filename: string) {
    const sectionHeaderHeight = isCompactExport ? 28 : 36;
    const sectionFooterGap = isCompactExport ? 8 : 12;
    const cardHeight = (isCompactExport ? 164 : CARD_HEIGHT) + (screenshotFields.description ? 16 : 0);
    const imageHeight = isCompactExport ? 82 : CARD_IMAGE_HEIGHT;
    const posterWidth = POSTER_WIDTH;
    const cardWidth = (posterWidth - POSTER_PADDING * 2 - SECTION_INSET * 2 - CARD_GAP * (exportColumns - 1)) / exportColumns;
    const rows = groupsToCapture.reduce(
      (sum, group) => sum + Math.ceil(group.items.length / exportColumns),
      0
    );
    const posterHeight =
      POSTER_PADDING * 2 +
      groupsToCapture.length * (sectionHeaderHeight + sectionFooterGap) +
      rows * cardHeight +
      Math.max(rows - groupsToCapture.length, 0) * CARD_GAP;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not supported in this browser.");
    }

    const logicalPosterHeight = Math.max(320, posterHeight);
    const exportScale = Math.max(
      1,
      Math.min(EXPORT_PIXEL_SCALE, MAX_CANVAS_DIMENSION / Math.max(posterWidth, logicalPosterHeight))
    );

    canvas.width = Math.ceil(posterWidth * exportScale);
    canvas.height = Math.ceil(logicalPosterHeight * exportScale);
    context.scale(exportScale, exportScale);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const background = context.createLinearGradient(0, 0, posterWidth, logicalPosterHeight);
    background.addColorStop(0, "#020617");
    background.addColorStop(0.55, "#101827");
    background.addColorStop(1, "#171717");
    context.fillStyle = background;
    context.fillRect(0, 0, posterWidth, logicalPosterHeight);

    let y = POSTER_PADDING;

    for (const group of groupsToCapture) {
      const sectionRows = Math.ceil(group.items.length / exportColumns);
      const sectionHeight = sectionHeaderHeight + sectionRows * cardHeight + Math.max(sectionRows - 1, 0) * CARD_GAP + sectionFooterGap;

      roundedRect(context, POSTER_PADDING, y, posterWidth - POSTER_PADDING * 2, sectionHeight, 10);
      context.fillStyle = "rgba(255,255,255,0.045)";
      context.fill();
      context.strokeStyle = "rgba(255,255,255,0.1)";
      context.stroke();

      context.fillStyle = "#67e8f9";
      context.font = `900 ${isCompactExport ? 16 : 18}px Arial, sans-serif`;
      fillReadableText(context, group.label.toUpperCase(), POSTER_PADDING + SECTION_INSET, y + (isCompactExport ? 20 : 26));
      context.fillStyle = "#e2e8f0";
      context.font = `800 ${isCompactExport ? 11 : 13}px Arial, sans-serif`;
      context.textAlign = "right";
      fillReadableText(
        context,
        `${group.items.length.toLocaleString()} item${group.items.length === 1 ? "" : "s"}`,
        posterWidth - POSTER_PADDING - SECTION_INSET,
        y + (isCompactExport ? 20 : 26)
      );
      context.textAlign = "left";

      const images = await loadPosterImages(group.items.map((item) => item.image));

      group.items.forEach((item, index) => {
        const column = index % exportColumns;
        const row = Math.floor(index / exportColumns);
        const x = POSTER_PADDING + SECTION_INSET + column * (cardWidth + CARD_GAP);
        const cardY = y + sectionHeaderHeight + row * (cardHeight + CARD_GAP);

        roundedRect(context, x, cardY, cardWidth, cardHeight, 8);
        context.fillStyle = "rgba(2,6,23,0.78)";
        context.fill();
        context.strokeStyle = "rgba(255,255,255,0.10)";
        context.stroke();

        const imagePad = isCompactExport ? 5 : 8;
        roundedRect(context, x + imagePad, cardY + imagePad, cardWidth - imagePad * 2, imageHeight, 7);
        const imageBackground = context.createLinearGradient(x, cardY, x + cardWidth, cardY + imageHeight);
        imageBackground.addColorStop(0, "#0f172a");
        imageBackground.addColorStop(1, "#111827");
        context.fillStyle = imageBackground;
        context.fill();

        const image = images[index];
        if (image) {
          drawContainedImage(context, image, x + imagePad + 3, cardY + imagePad + 3, cardWidth - imagePad * 2 - 6, imageHeight - 6);
        } else {
          drawImageFallback(context, item.name, x + imagePad + 3, cardY + imagePad + 3, cardWidth - imagePad * 2 - 6, imageHeight - 6);
        }

        const metaY = cardY + (isCompactExport ? 101 : 160);
        const tinyCard = cardWidth < 70;
        const metaFontSize = isCompactExport ? (tinyCard ? 7 : 8) : 10;
        const nameFontSize = isCompactExport ? (tinyCard ? 9 : 12) : 15;
        const nameLineHeight = isCompactExport ? (tinyCard ? 10 : 13) : 17;
        const descriptionFontSize = isCompactExport ? (tinyCard ? 8 : 9) : 10;
        const priceFontSize = isCompactExport ? (tinyCard ? 8 : 10) : 13;

        context.fillStyle = "#94a3b8";
        context.font = `${isCompactExport ? "800" : "800"} ${metaFontSize}px Arial, sans-serif`;
        fillReadableText(context, item.type.toUpperCase(), x + 7, metaY, cardWidth * 0.54);
        context.fillStyle = "#cffafe";
        context.textAlign = "right";
        fillReadableText(context, item.rarity.toUpperCase(), x + cardWidth - 7, metaY, cardWidth * 0.42);
        context.textAlign = "left";
        context.fillStyle = "#ffffff";
        context.font = `900 ${nameFontSize}px Arial, sans-serif`;
        drawText(context, item.name, x + 7, cardY + (isCompactExport ? 116 : 181), cardWidth - 14, nameLineHeight, 2);

        if (screenshotFields.description) {
          context.fillStyle = "#94a3b8";
          context.font = `800 ${descriptionFontSize}px Arial, sans-serif`;
          drawText(context, item.season, x + 7, cardY + (isCompactExport ? 139 : 218), cardWidth - 14, isCompactExport ? 9 : 12, 1);
        }

        const priceY = cardY + cardHeight - 7;
        if (isCompactExport) {
          context.font = `900 ${priceFontSize}px Arial, sans-serif`;
          if (screenshotFields.vbucks) {
            context.fillStyle = "#bae6fd";
            fillReadableText(
              context,
              `${item.price.toLocaleString()} V-Bucks`,
              x + 7,
              screenshotFields.birr ? priceY - 10 : priceY,
              cardWidth - 14
            );
          }

          if (screenshotFields.birr) {
            context.fillStyle = "#fde68a";
            fillReadableText(context, `${Math.round(item.price * birrPerVbuck).toLocaleString()} Birr`, x + 7, priceY, cardWidth - 14);
          }
        } else {
          if (screenshotFields.vbucks) {
          context.fillStyle = "#bae6fd";
          context.font = "900 13px Arial, sans-serif";
          fillReadableText(context, `${item.price.toLocaleString()} V-Bucks`, x + 10, priceY);
          }

          if (screenshotFields.birr) {
          context.fillStyle = "#fde68a";
          context.font = "900 13px Arial, sans-serif";
          context.textAlign = "right";
          fillReadableText(
            context,
            `${Math.round(item.price * birrPerVbuck).toLocaleString()} Birr`,
            x + cardWidth - 10,
            priceY
          );
          context.textAlign = "left";
          }
        }
      });

      y += sectionHeight + 14;
    }

    await downloadCanvasPng(canvas, filename);
  }

  async function downloadPngs() {
    setIsDownloading(true);
    setDownloadMessage("Preparing your PNG...");

    try {
      await captureGroups(groups, "fortnite-items-selected.png");
      setDownloadMessage("PNG generated. Check your downloads or file manager.");
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

      <section className="min-h-[calc(100vh-108px)]">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#08101d]/95 p-3 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex items-center justify-between gap-3 md:hidden">
            <button
              className="flex h-11 items-center gap-3 rounded-md border border-white/10 bg-slate-950 px-4 text-sm font-black text-white"
              onClick={() => setIsMobileControlsOpen((isOpen) => !isOpen)}
              type="button"
            >
              <span aria-hidden="true" className="grid gap-1">
                <span className="block h-0.5 w-5 rounded bg-cyan-200" />
                <span className="block h-0.5 w-5 rounded bg-cyan-200" />
                <span className="block h-0.5 w-5 rounded bg-cyan-200" />
              </span>
              Options
            </button>
            <button
              className="h-11 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 disabled:cursor-wait disabled:opacity-60"
              disabled={!shop || isDownloading || filteredCount === 0}
              onClick={downloadPngs}
              type="button"
            >
              {isDownloading ? "Rendering..." : "Download"}
            </button>
          </div>

          <div className={`${isMobileControlsOpen ? "grid" : "hidden"} gap-4 pt-3 md:grid md:pt-0`}>
            <div className="grid gap-3 md:flex md:flex-wrap md:items-end">
              <label className="grid min-w-0 flex-1 gap-2 md:min-w-[220px]">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Screenshot categories
                </span>
                <div className="relative" ref={categoryMenuRef}>
                  <button
                    className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-950 px-3 text-left text-sm font-bold text-white outline-none ring-cyan-300/30 transition hover:bg-white/[0.06] focus:ring-4"
                    data-testid="category-select"
                    onClick={() => setIsCategoryMenuOpen((isOpen) => !isOpen)}
                    type="button"
                  >
                    <span className="truncate">
                      {selectedCategories.length === 0
                        ? "No categories selected"
                        : selectedCategories.length === SHOP_CATEGORIES.length
                        ? `All categories (${totalShopCount})`
                        : `${selectedCategories.length} selected`}
                    </span>
                    <span aria-hidden="true" className="text-cyan-200">
                      v
                    </span>
                  </button>

                  {isCategoryMenuOpen ? (
                    <div className="absolute left-0 right-0 z-30 mt-2 max-h-[min(24rem,70vh)] overflow-auto rounded-lg border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-black/50">
                      <div className="mb-2">
                        <button
                          className="h-9 w-full rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
                          onClick={toggleAllCategories}
                          type="button"
                        >
                          {selectedCategories.length === SHOP_CATEGORIES.length ? "Unmark all" : "Mark all"}
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

              <label className="grid min-w-0 flex-[1.4] gap-2 md:min-w-[240px]">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Filter by name or type
                </span>
                <input
                  className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none ring-cyan-300/30 focus:ring-4"
                  onChange={(event) => setNameFilter(event.target.value)}
                  placeholder="Outfit name, pickaxe, wrap..."
                  value={nameFilter}
                />
              </label>

              <label className="grid min-w-0 flex-1 gap-2 md:min-w-[170px]">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Rarity
                </span>
                <select
                  className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none ring-cyan-300/30 focus:ring-4"
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

              <label className="grid min-w-0 flex-[1.2] gap-2 md:min-w-[220px]">
                <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Season
                </span>
                <select
                  className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none ring-cyan-300/30 focus:ring-4"
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

              <div className="grid min-w-0 grid-cols-2 gap-3 md:min-w-[260px]">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                    Columns
                  </span>
                  <input
                    className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none ring-cyan-300/30 focus:ring-4"
                    data-testid="export-columns"
                    inputMode="numeric"
                    max={MAX_EXPORT_COLUMNS}
                    min={MIN_EXPORT_COLUMNS}
                    onBlur={commitExportColumnInput}
                    onChange={(event) => handleExportColumnInput(event.target.value)}
                    onFocus={() => setIsEditingExportColumns(true)}
                    pattern="[0-9]*"
                    type="text"
                    value={exportColumnInput}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                    Birr rate
                  </span>
                  <input
                    className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none ring-cyan-300/30 focus:ring-4"
                    min="0"
                    onChange={(event) => setBirrPerVbuck(Number(event.target.value) || 0)}
                    step="0.01"
                    type="number"
                    value={birrPerVbuck}
                  />
                </label>
              </div>

              <fieldset className="grid min-w-0 flex-1 gap-2 md:min-w-[260px]">
                <legend className="text-xs font-black uppercase tracking-normal text-slate-300">
                  Screenshot details
                </legend>
                <div className="grid grid-cols-3 gap-2 rounded-md border border-white/10 bg-slate-950 p-2">
                  {[
                    ["vbucks", "V-Bucks"],
                    ["birr", "Birr"],
                    ["description", "Description"]
                  ].map(([field, label]) => (
                    <label className="flex min-h-9 items-center justify-center gap-2 rounded bg-white/[0.04] px-2 text-xs font-black text-slate-200" key={field}>
                      <input
                        checked={screenshotFields[field as keyof ScreenshotFields]}
                        className="h-4 w-4 accent-cyan-300"
                        onChange={() => toggleScreenshotField(field as keyof ScreenshotFields)}
                        type="checkbox"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {isAutoPostPanelOpen ? (
              <fieldset className="grid gap-3 rounded-md border border-cyan-300/20 bg-black/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <legend className="text-xs font-black uppercase tracking-normal text-cyan-100">
                    Telegram auto posting
                  </legend>
                  <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-white/10 bg-slate-950 px-3">
                    <input
                      checked={autoPostSettings.enabled}
                      className="h-5 w-5 accent-cyan-300"
                      onChange={(event) =>
                        setAutoPostSettings((current) => ({
                          ...current,
                          enabled: event.target.checked
                        }))
                      }
                      type="checkbox"
                    />
                    <span className="text-sm font-black text-white">
                      {autoPostSettings.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                      Post every
                    </span>
                    <select
                      className="h-11 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none ring-cyan-300/30 focus:ring-4"
                      onChange={(event) =>
                        setAutoPostSettings((current) => ({
                          ...current,
                          intervalDays: Number(event.target.value)
                        }))
                      }
                      value={autoPostSettings.intervalDays}
                    >
                      {Array.from({ length: 30 }, (_, index) => index + 1).map((days) => (
                        <option key={days} value={days}>
                          {days} {days === 1 ? "day" : "days"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs font-black uppercase tracking-normal text-slate-300">
                      Caption
                    </span>
                    <input
                      className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none ring-cyan-300/30 focus:ring-4"
                      maxLength={800}
                      onChange={(event) =>
                        setAutoPostSettings((current) => ({
                          ...current,
                          caption: event.target.value
                        }))
                      }
                      value={autoPostSettings.caption}
                    />
                  </label>

                  <button
                    className="h-11 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                    onClick={openAutoPostSettingsIssue}
                    type="button"
                  >
                    Save settings
                  </button>
                </div>

                <p className="truncate text-xs font-bold text-slate-400">
                  {renderAutoPostCaption(autoPostSettings.caption || DEFAULT_AUTO_POST_CAPTION)}
                </p>
              </fieldset>
            ) : null}

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

                <button
                  className="h-10 rounded-md border border-white/10 bg-slate-950 px-4 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                  onClick={resetFilters}
                  type="button"
                >
                  Reset
                </button>

                <button
                  className={`h-10 rounded-md border px-4 text-sm font-black transition ${
                    autoPostSettings.enabled
                      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20"
                      : "border-white/10 bg-slate-950 text-slate-200 hover:bg-white/10"
                  }`}
                  onClick={() => setIsAutoPostPanelOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  Auto posting: {autoPostSettings.enabled ? "On" : "Off"}
                </button>
              </div>

              <button
                className="hidden h-12 w-full rounded-md bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60 sm:w-auto md:block"
                data-testid="download-pngs"
                disabled={!shop || isDownloading || filteredCount === 0}
                onClick={downloadPngs}
                type="button"
              >
                {isDownloading ? "Rendering..." : "Download PNG"}
              </button>
            </div>

            <div className="grid gap-2 rounded-lg bg-black/20 p-3 text-sm text-slate-300 sm:flex sm:items-center sm:justify-between">
              <span>
                Showing <strong className="text-white">{filteredCount}</strong> of{" "}
                <strong className="text-white">{totalShopCount}</strong> items for{" "}
                <strong className="text-cyan-200">{categorySummary}</strong>.
                <span className="block pt-1 text-xs text-slate-400">
                  Layout: {exportColumns} columns per PNG.
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
                  ? "min-h-full overflow-hidden rounded-lg border border-white/10 bg-black/35 p-2 shadow-2xl shadow-black/30 md:overflow-x-auto"
                  : "min-h-full overflow-hidden md:overflow-x-auto"
              }
            >
              <div data-testid="shop-canvas">
                <ScreenshotCanvas
                  birrPerVbuck={birrPerVbuck}
                  compact={isCompactPreview}
                  columns={exportColumns}
                  groups={groups}
                  screenshotFields={screenshotFields}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
