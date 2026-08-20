import {
  SHOP_CATEGORIES,
  type ShopCategory,
  type ShopItem
} from "@/lib/shop";

export type LiveDirection = "up" | "down";
export type LiveBackground = "transparent" | "solid";

export type LiveOverlaySettings = {
  categories: ShopCategory[];
  nameFilter: string;
  rarityFilter: string;
  seasonFilter: string;
  birrRate: number;
  showVbucks: boolean;
  showBirr: boolean;
  showDescription: boolean;
  direction: LiveDirection;
  speed: number;
  gap: number;
  cardWidth: number;
  background: LiveBackground;
};

export const LIVE_SETTINGS_STORAGE_KEY = "fortnite-live-overlay-settings:v1";
export const LIVE_SHOP_CACHE_KEY = "fortnite-live-shop-payload:v1";

export const DEFAULT_LIVE_OVERLAY_SETTINGS: LiveOverlaySettings = {
  categories: ["skins"],
  nameFilter: "",
  rarityFilter: "all",
  seasonFilter: "all",
  birrRate: 1,
  showVbucks: true,
  showBirr: true,
  showDescription: false,
  direction: "up",
  speed: 36,
  gap: 16,
  cardWidth: 320,
  background: "transparent"
};

export const LIVE_LIMITS = {
  birrRate: { min: 0.01, max: 1000 },
  speed: { min: 10, max: 120 },
  gap: { min: 4, max: 40 },
  cardWidth: { min: 220, max: 520 }
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function cleanFilter(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 160) || fallback;
}

function validCategories(value: unknown, fallback: ShopCategory[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const allowed = new Set<string>(SHOP_CATEGORIES);
  return Array.from(
    new Set(value.filter((category): category is ShopCategory => typeof category === "string" && allowed.has(category)))
  );
}

function queryBoolean(value: string | null, fallback: boolean) {
  if (value === "1") {
    return true;
  }

  if (value === "0") {
    return false;
  }

  return fallback;
}

export function normalizeLiveOverlaySettings(value: unknown): LiveOverlaySettings {
  const source = value && typeof value === "object" ? (value as Partial<LiveOverlaySettings>) : {};
  const defaults = DEFAULT_LIVE_OVERLAY_SETTINGS;

  return {
    categories: validCategories(source.categories, defaults.categories),
    nameFilter: cleanFilter(source.nameFilter, defaults.nameFilter),
    rarityFilter: cleanFilter(source.rarityFilter, defaults.rarityFilter),
    seasonFilter: cleanFilter(source.seasonFilter, defaults.seasonFilter),
    birrRate: finiteNumber(
      source.birrRate,
      defaults.birrRate,
      LIVE_LIMITS.birrRate.min,
      LIVE_LIMITS.birrRate.max
    ),
    showVbucks: typeof source.showVbucks === "boolean" ? source.showVbucks : defaults.showVbucks,
    showBirr: typeof source.showBirr === "boolean" ? source.showBirr : defaults.showBirr,
    showDescription:
      typeof source.showDescription === "boolean" ? source.showDescription : defaults.showDescription,
    direction: source.direction === "down" ? "down" : "up",
    speed: finiteNumber(source.speed, defaults.speed, LIVE_LIMITS.speed.min, LIVE_LIMITS.speed.max),
    gap: finiteNumber(source.gap, defaults.gap, LIVE_LIMITS.gap.min, LIVE_LIMITS.gap.max),
    cardWidth: finiteNumber(
      source.cardWidth,
      defaults.cardWidth,
      LIVE_LIMITS.cardWidth.min,
      LIVE_LIMITS.cardWidth.max
    ),
    background: source.background === "solid" ? "solid" : "transparent"
  };
}

export function parseLiveOverlaySearch(search: string): LiveOverlaySettings {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const defaults = DEFAULT_LIVE_OVERLAY_SETTINGS;
  const categoryParam = params.get("categories");
  const categories =
    categoryParam === null
      ? defaults.categories
      : validCategories(categoryParam.split(",").filter(Boolean), []);

  return normalizeLiveOverlaySettings({
    categories,
    nameFilter: params.get("name") ?? defaults.nameFilter,
    rarityFilter: params.get("rarity") ?? defaults.rarityFilter,
    seasonFilter: params.get("season") ?? defaults.seasonFilter,
    birrRate: params.get("birrRate") ?? defaults.birrRate,
    showVbucks: queryBoolean(params.get("vbucks"), defaults.showVbucks),
    showBirr: queryBoolean(params.get("birr"), defaults.showBirr),
    showDescription: queryBoolean(params.get("description"), defaults.showDescription),
    direction: params.get("direction") === "down" ? "down" : "up",
    speed: params.get("speed") ?? defaults.speed,
    gap: params.get("gap") ?? defaults.gap,
    cardWidth: params.get("cardWidth") ?? defaults.cardWidth,
    background: params.get("background") === "solid" ? "solid" : "transparent"
  });
}

export function buildLiveOverlaySearch(settings: LiveOverlaySettings) {
  const normalized = normalizeLiveOverlaySettings(settings);
  const params = new URLSearchParams();

  params.set("categories", normalized.categories.join(","));
  params.set("vbucks", normalized.showVbucks ? "1" : "0");
  params.set("birr", normalized.showBirr ? "1" : "0");
  params.set("description", normalized.showDescription ? "1" : "0");
  params.set("birrRate", String(normalized.birrRate));
  params.set("direction", normalized.direction);
  params.set("speed", String(normalized.speed));
  params.set("gap", String(normalized.gap));
  params.set("cardWidth", String(normalized.cardWidth));
  params.set("background", normalized.background);

  if (normalized.nameFilter) {
    params.set("name", normalized.nameFilter);
  }

  if (normalized.rarityFilter !== "all") {
    params.set("rarity", normalized.rarityFilter);
  }

  if (normalized.seasonFilter !== "all") {
    params.set("season", normalized.seasonFilter);
  }

  return params;
}

export function filterLiveItems(items: ShopItem[], settings: LiveOverlaySettings) {
  const selectedCategories = new Set(settings.categories);
  const normalizedName = settings.nameFilter.trim().toLowerCase();

  return items.filter((item) => {
    const matchesName =
      !normalizedName ||
      item.name.toLowerCase().includes(normalizedName) ||
      item.type.toLowerCase().includes(normalizedName);

    return (
      selectedCategories.has(item.category) &&
      matchesName &&
      (settings.rarityFilter === "all" || item.rarity === settings.rarityFilter) &&
      (settings.seasonFilter === "all" || item.season === settings.seasonFilter)
    );
  });
}

export function uniqueLiveOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
