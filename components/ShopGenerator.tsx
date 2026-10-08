"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Grid2X2,
  LoaderCircle,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  X,
} from "lucide-react";
import { AutoPostSettings } from "@/components/AutoPostSettings";
import { ScreenshotCanvas } from "@/components/ScreenshotCanvas";
import { useDailyShopData } from "@/components/useDailyShopData";
import {
  categoryLabels,
  groupShopItems,
  SHOP_CATEGORIES,
  type ShopCategory,
} from "@/lib/shop";
import {
  renderPoster,
  saveExport,
  splitPosterGroups,
  type ExportFile,
  type ScreenshotFields,
} from "@/lib/poster";

export type { ScreenshotFields } from "@/lib/poster";
const DEFAULT_COLUMNS = 6;
const defaultFields: ScreenshotFields = {
  birr: true,
  vbucks: true,
  description: false,
};

export function ShopGenerator() {
  const { shop, error, isRefreshing, retry } = useDailyShopData();
  const [birrPerVbuck, setBirrPerVbuck] = useState(1);
  const [rateInput, setRateInput] = useState("1");
  const [selectedCategories, setSelectedCategories] = useState<ShopCategory[]>([
    "skins",
  ]);
  const [nameFilter, setNameFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [columnInput, setColumnInput] = useState(String(DEFAULT_COLUMNS));
  const [fields, setFields] = useState<ScreenshotFields>(defaultFields);
  const [parts, setParts] = useState(1);
  const [exportWidth, setExportWidth] = useState(2160);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAutoPostOpen, setIsAutoPostOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [downloadError, setDownloadError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState<ExportFile[]>([]);
  const categoryRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const filesRef = useRef<ExportFile[]>([]);
  const downloadLock = useRef(false);

  useEffect(
    () => () => {
      filesRef.current.forEach((file) => URL.revokeObjectURL(file.url));
    },
    [],
  );
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!categoryRef.current?.contains(event.target as Node))
        setIsCategoryOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCategoryOpen(false);
        setIsMobileOpen(false);
        optionsButtonRef.current?.focus();
      }
      if (
        event.key === "Tab" &&
        isMobileOpen &&
        window.matchMedia("(max-width: 767px)").matches
      ) {
        const focusable = optionsRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select, a[href]",
        );
        const first = focusable?.[0];
        const last = focusable?.[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [isMobileOpen]);
  useEffect(() => {
    if (!isMobileOpen || !window.matchMedia("(max-width: 767px)").matches)
      return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    optionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileOpen]);

  const items = shop?.items;
  const filteredItems = useMemo(() => {
    const name = nameFilter.trim().toLowerCase();
    return (items ?? []).filter(
      (item) =>
        selectedCategories.includes(item.category) &&
        (!name ||
          item.name.toLowerCase().includes(name) ||
          item.type.toLowerCase().includes(name)) &&
        (rarityFilter === "all" || item.rarity === rarityFilter) &&
        (seasonFilter === "all" || item.season === seasonFilter),
    );
  }, [items, selectedCategories, nameFilter, rarityFilter, seasonFilter]);
  const groups = useMemo(() => groupShopItems(filteredItems), [filteredItems]);
  const rarities = useMemo(
    () => [...new Set(items?.map((item) => item.rarity))].sort(),
    [items],
  );
  const seasons = useMemo(
    () => [...new Set(items?.map((item) => item.season))].sort(),
    [items],
  );
  const counts = useMemo(() => {
    const result = new Map<ShopCategory, number>();
    items?.forEach((item) =>
      result.set(item.category, (result.get(item.category) ?? 0) + 1),
    );
    return result;
  }, [items]);
  const shopDate = shop
    ? new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(shop.updatedAt))
    : "Loading today's shop";
  const selectionName =
    selectedCategories.length === SHOP_CATEGORIES.length
      ? "All categories"
      : selectedCategories.length === 1
        ? categoryLabels[selectedCategories[0]]
        : `${selectedCategories.length} categories`;

  function toggleCategory(category: ShopCategory) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  }
  function reset() {
    setSelectedCategories(["skins"]);
    setNameFilter("");
    setRarityFilter("all");
    setSeasonFilter("all");
    setColumns(DEFAULT_COLUMNS);
    setColumnInput(String(DEFAULT_COLUMNS));
    setFields(defaultFields);
  }
  function editColumns(value: string) {
    const text = value.replace(/\D/g, "");
    setColumnInput(text);
    const number = Number(text);
    if (number >= 2 && number <= 20) setColumns(number);
  }
  function commitColumns() {
    const next = columnInput.trim()
      ? Math.min(20, Math.max(2, Number(columnInput)))
      : columns;
    setColumns(next);
    setColumnInput(String(next));
  }
  async function download() {
    if (downloadLock.current || !filteredItems.length) return;
    downloadLock.current = true;
    setIsDownloading(true);
    setDownloadError(false);
    setProgress(0);
    setDownloadMessage("Preparing artwork...");
    const nextFiles: ExportFile[] = [];
    try {
      const pages = splitPosterGroups(groups, columns, parts);
      let completed = 0;
      for (let i = 0; i < pages.length; i++) {
        const blob = await renderPoster(
          pages[i],
          { columns, fields, birrRate: birrPerVbuck, width: exportWidth },
          (count) => {
            setProgress(
              Math.round(((completed + count) / filteredItems.length) * 100),
            );
            setDownloadMessage(
              `Preparing artwork ${completed + count} of ${filteredItems.length}`,
            );
          },
        );
        completed += pages[i].reduce(
          (total, group) => total + group.items.length,
          0,
        );
        nextFiles.push({
          url: URL.createObjectURL(blob),
          filename: `fortnite-${shop?.updatedAt.slice(0, 10)}-${pages.length > 1 ? `${i + 1}-of-${pages.length}` : "items"}.png`,
          size: blob.size,
        });
      }
      filesRef.current.forEach((file) => URL.revokeObjectURL(file.url));
      filesRef.current = nextFiles;
      setFiles(nextFiles);
      nextFiles.forEach(saveExport);
      setDownloadMessage(
        `${nextFiles.length === 1 ? "PNG ready" : `${nextFiles.length} PNGs ready`} · ${filteredItems.length} items with verified artwork`,
      );
    } catch (reason) {
      nextFiles.forEach((file) => URL.revokeObjectURL(file.url));
      setDownloadError(true);
      setDownloadMessage(
        reason instanceof Error
          ? reason.message
          : "Unable to create PNG. Please retry.",
      );
    } finally {
      downloadLock.current = false;
      setIsDownloading(false);
    }
  }

  return (
    <main className="shop-generator">
      <header className="generator-header">
        <div className="generator-brand">
          <Grid2X2 size={25} aria-hidden="true" />
          <div>
            <p>Abyssinia Quest</p>
            <h1>Fortnite Item Shop Generator</h1>
          </div>
        </div>
        <div className="header-meta">
          <span className="shop-date">{shopDate}</span>
          <button
            type="button"
            className="secondary-button"
            aria-label="Sync shop"
            aria-busy={isRefreshing}
            title="Check for the latest published shop"
            disabled={isRefreshing}
            onClick={retry}
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "spin" : undefined}
              aria-hidden="true"
            />
            {isRefreshing ? "Syncing..." : "Sync"}
          </button>
          <Link href="/live/" prefetch={false} className="secondary-button">
            <Radio size={16} />
            Live Overlay
          </Link>
        </div>
      </header>

      <div className="mobile-action-bar">
        <button
          ref={optionsButtonRef}
          className="secondary-button"
          onClick={() => setIsMobileOpen(true)}
          aria-expanded={isMobileOpen}
          aria-controls="shop-options"
        >
          <Settings2 size={17} />
          Options
        </button>
        <span>{filteredItems.length} items</span>
        <button
          className="primary-button"
          disabled={!filteredItems.length || isDownloading}
          onClick={download}
        >
          {isDownloading ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <ArrowDownToLine size={17} />
          )}
          {isDownloading ? `${progress}%` : "Download"}
        </button>
      </div>
      {isMobileOpen && (
        <button
          className="options-backdrop"
          aria-label="Close options"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <div
        id="shop-options"
        ref={optionsRef}
        className={`generator-options ${isMobileOpen ? "is-open" : ""}`}
      >
        <div className="mobile-options-heading">
          <h2>Shop & export options</h2>
          <button
            className="icon-button"
            aria-label="Close options"
            onClick={() => setIsMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="filter-row">
          <div className="field category-field">
            <span>Screenshot categories</span>
            <div className="category-control" ref={categoryRef}>
              <button
                data-testid="category-select"
                className="select-button"
                aria-expanded={isCategoryOpen}
                aria-controls="category-options"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              >
                <span>
                  {selectedCategories.length === SHOP_CATEGORIES.length
                    ? "All categories"
                    : `${selectionName} · ${selectedCategories.length} selected`}
                </span>
                <ChevronDown size={16} />
              </button>
              {isCategoryOpen && (
                <div className="category-menu" id="category-options">
                  <button
                    className="select-all-button"
                    onClick={() =>
                      setSelectedCategories(
                        selectedCategories.length === SHOP_CATEGORIES.length
                          ? []
                          : [...SHOP_CATEGORIES],
                      )
                    }
                  >
                    <Check size={15} />
                    {selectedCategories.length === SHOP_CATEGORIES.length
                      ? "Unmark all"
                      : "Mark all"}
                  </button>
                  {SHOP_CATEGORIES.map((category) => (
                    <label key={category}>
                      <input
                        data-testid={`category-check-${category}`}
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                      />
                      <span>{categoryLabels[category]}</span>
                      <small>{counts.get(category) ?? 0}</small>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <label className="field search-field">
            <span>Name or type</span>
            <div className="search-control">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search items..."
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
              />
            </div>
          </label>
          <label className="field">
            <span>Rarity</span>
            <select
              value={rarityFilter}
              onChange={(event) => setRarityFilter(event.target.value)}
            >
              <option value="all">All rarities</option>
              {rarities.map((rarity) => (
                <option key={rarity}>{rarity}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Season</span>
            <select
              value={seasonFilter}
              onChange={(event) => setSeasonFilter(event.target.value)}
            >
              <option value="all">All seasons</option>
              {seasons.map((season) => (
                <option key={season}>{season}</option>
              ))}
            </select>
          </label>
          <button
            className="icon-button reset-button"
            aria-label="Reset filters"
            title="Reset filters"
            onClick={reset}
          >
            <RotateCcw size={17} />
          </button>
        </div>
        <div className="export-row">
          <label className="field number-field">
            <span>Columns</span>
            <input
              data-testid="export-columns"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              min="2"
              max="20"
              value={columnInput}
              onChange={(event) => editColumns(event.target.value)}
              onBlur={commitColumns}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </label>
          <label className="field number-field">
            <span>Birr rate</span>
            <input
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={(event) => {
                const value = event.target.value;
                if (/^\d*\.?\d*$/.test(value)) {
                  setRateInput(value);
                  const rate = Number(value);
                  if (value && Number.isFinite(rate) && rate <= 100000)
                    setBirrPerVbuck(rate);
                }
              }}
              onBlur={() => setRateInput(String(birrPerVbuck))}
            />
          </label>
          <fieldset className="detail-fields">
            <legend>Item details</legend>
            <div>
              {(["vbucks", "birr", "description"] as const).map((field) => (
                <label className="check-control" key={field}>
                  <input
                    type="checkbox"
                    checked={fields[field]}
                    onChange={() =>
                      setFields({ ...fields, [field]: !fields[field] })
                    }
                  />
                  {field === "vbucks"
                    ? "V-Bucks"
                    : field === "birr"
                      ? "Birr"
                      : "Description"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field quality-field">
            <span>PNG quality</span>
            <select
              value={exportWidth}
              onChange={(event) => setExportWidth(Number(event.target.value))}
            >
              <option value={2160}>High · up to 2160 px</option>
              <option value={3240}>Ultra · up to 3240 px</option>
            </select>
          </label>
          <label className="field parts-field">
            <span>Split export</span>
            <select
              value={parts}
              onChange={(event) => setParts(Number(event.target.value))}
            >
              <option value={1}>1 PNG</option>
              <option value={2}>2 PNGs</option>
              <option value={3}>3 PNGs</option>
            </select>
          </label>
          <div className="export-actions">
            <button
              className="icon-button"
              aria-label="Telegram auto posting"
              title="Telegram auto posting"
              aria-expanded={isAutoPostOpen}
              onClick={() => setIsAutoPostOpen(!isAutoPostOpen)}
            >
              <Send size={17} />
            </button>
            <button
              className="primary-button desktop-download"
              data-testid="download-pngs"
              disabled={!filteredItems.length || isDownloading}
              onClick={download}
            >
              {isDownloading ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ArrowDownToLine size={17} />
              )}
              {isDownloading ? `Preparing ${progress}%` : "Download PNG"}
            </button>
          </div>
        </div>
        {isAutoPostOpen && (
          <AutoPostSettings onClose={() => setIsAutoPostOpen(false)} />
        )}
        <button
          className="primary-button mobile-apply"
          onClick={() => setIsMobileOpen(false)}
        >
          <Check size={16} />
          Show {filteredItems.length} items
        </button>
      </div>

      <section className="generator-content">
        <div className="selection-summary">
          <div>
            <h2>{selectionName}</h2>
            <span>
              {filteredItems.length} of {items?.length ?? 0} items
            </span>
          </div>
          <span>
            {columns} columns · Up to {exportWidth}px
          </span>
        </div>
        {error && (
          <div className="shop-notice" role="alert">
            <span>{error}</span>
            <button
              className="secondary-button"
              disabled={isRefreshing}
              onClick={retry}
            >
              {isRefreshing ? "Checking..." : "Retry"}
            </button>
          </div>
        )}
        {downloadMessage && (
          <div
            className={`export-status ${downloadError ? "has-error" : ""}`}
            role="status"
            aria-live="polite"
          >
            <div>
              {isDownloading ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                !downloadError && <Check size={18} />
              )}
              <span>{downloadMessage}</span>
            </div>
            {isDownloading && (
              <progress
                max="100"
                value={progress}
                aria-label="PNG export progress"
              />
            )}
            {!isDownloading && !downloadError && (
              <div className="download-links">
                {files.map((file, index) => (
                  <a key={file.url} href={file.url} download={file.filename}>
                    <ArrowDownToLine size={14} />
                    {files.length > 1 ? `Save PNG ${index + 1}` : "Save again"}
                    <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
        {!shop ? (
          <div
            className="shop-loading"
            aria-label="Loading shop"
            aria-busy="true"
          >
            {Array.from({ length: 18 }, (_, index) => (
              <div key={index} />
            ))}
          </div>
        ) : (
          <div data-testid="shop-canvas">
            <ScreenshotCanvas
              birrPerVbuck={birrPerVbuck}
              columns={columns}
              groups={groups}
              screenshotFields={fields}
            />
          </div>
        )}
      </section>
      <footer className="generator-footer">
        <span>Unofficial Fortnite tool. Not affiliated with Epic Games.</span>
        <span>
          Shop reset: 00:00 UTC / 03:00 EAT · Artwork: Fortnite-API · Birr
          prices are estimates.
        </span>
      </footer>
    </main>
  );
}
