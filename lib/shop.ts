export const SHOP_URL = "https://fortnite-api.com/v2/shop";

export const SHOP_CATEGORIES = [
  "skins",
  "emotes",
  "pickaxes",
  "kicks",
  "bundles",
  "gliders",
  "wraps",
  "backBlings",
  "jamTracks",
  "uncategorized"
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export type ApiPrice = {
  finalPrice?: number;
  regularPrice?: number;
};

export type ApiCosmetic = {
  id: string;
  name: string;
  type?: {
    value?: string;
    displayValue?: string;
  };
  rarity?: {
    displayValue?: string;
    value?: string;
  };
  images?: {
    icon?: string;
    smallIcon?: string;
    featured?: string;
  };
  introduction?: {
    chapter?: string;
    season?: string;
    text?: string;
  };
};

export type ApiTrack = {
  id: string;
  title: string;
  albumArt?: string;
};

export type ApiInstrument = {
  id: string;
  name: string;
  type?: {
    value?: string;
    displayValue?: string;
  };
  rarity?: {
    displayValue?: string;
    value?: string;
  };
  images?: {
    small?: string;
    large?: string;
  };
};

export type ApiLegoKit = {
  id?: string;
  name?: string;
  image?: string;
};

export type ApiEntry = {
  offerId?: string;
  devName?: string;
  regularPrice?: number;
  finalPrice?: number;
  price?: ApiPrice;
  bundle?: {
    name?: string;
    image?: string;
  };
  items?: ApiCosmetic[];
  brItems?: ApiCosmetic[];
  tracks?: ApiTrack[];
  instruments?: ApiInstrument[];
  legoKits?: ApiLegoKit[];
  newDisplayAsset?: {
    renderImages?: {
      image?: string;
    }[];
  };
};

export type ShopResponse = {
  data?: {
    date?: string;
    entries?: ApiEntry[];
  };
};

export type ShopItem = {
  id: string;
  name: string;
  type: string;
  image: string;
  rarity: string;
  season: string;
  price: number;
  category: ShopCategory;
};

export type ShopPayload = {
  source: string;
  updatedAt: string;
  cacheSeconds: number;
  items: ShopItem[];
};

export const categoryLabels: Record<ShopCategory, string> = {
  skins: "Skins",
  emotes: "Emotes",
  pickaxes: "Pickaxes",
  kicks: "Kicks",
  bundles: "Bundles",
  gliders: "Gliders",
  wraps: "Wraps",
  backBlings: "Back Blings",
  jamTracks: "Jam Tracks / Music",
  uncategorized: "Uncategorized"
};

function cleanDevName(value?: string) {
  if (!value) {
    return undefined;
  }

  const quotedName = value.match(/\[(.*?)\]/)?.[1];
  return quotedName ?? value.replaceAll("_", " ");
}

function firstDisplayImage(entry: ApiEntry) {
  return entry.newDisplayAsset?.renderImages?.find((image) => image.image)?.image;
}

function categoryFromType(entry: ApiEntry, typeValue?: string, typeLabel?: string): ShopCategory {
  const normalized = `${typeValue ?? ""} ${typeLabel ?? ""}`.toLowerCase();

  if (entry.bundle) {
    return "bundles";
  }

  if (entry.tracks?.length) {
    return "jamTracks";
  }

  if (normalized.includes("outfit") || normalized.includes("character")) {
    return "skins";
  }

  if (normalized.includes("emote") || normalized.includes("dance")) {
    return "emotes";
  }

  if (normalized.includes("pickaxe") || normalized.includes("harvesting")) {
    return "pickaxes";
  }

  if (normalized.includes("shoe") || normalized.includes("kick")) {
    return "kicks";
  }

  if (normalized.includes("glider")) {
    return "gliders";
  }

  if (normalized.includes("wrap")) {
    return "wraps";
  }

  if (normalized.includes("backpack") || normalized.includes("back bling")) {
    return "backBlings";
  }

  if (normalized.includes("music") || normalized.includes("instrument") || normalized.includes("mic")) {
    return "jamTracks";
  }

  return "uncategorized";
}

export function mapShopEntry(entry: ApiEntry): ShopItem | null {
  const primaryItem = entry.items?.[0] ?? entry.brItems?.[0];
  const primaryInstrument = entry.instruments?.[0];
  const primaryTrack = entry.tracks?.[0];
  const primaryLegoKit = entry.legoKits?.[0];
  const itemName = entry.bundle?.name ?? primaryItem?.name;
  const name =
    itemName ?? primaryInstrument?.name ?? primaryTrack?.title ?? primaryLegoKit?.name ?? cleanDevName(entry.devName);
  const image =
    entry.bundle?.image ??
    firstDisplayImage(entry) ??
    primaryItem?.images?.featured ??
    primaryItem?.images?.icon ??
    primaryItem?.images?.smallIcon ??
    primaryInstrument?.images?.large ??
    primaryInstrument?.images?.small ??
    primaryTrack?.albumArt ??
    primaryLegoKit?.image;
  const price =
    entry.finalPrice ??
    entry.price?.finalPrice ??
    entry.regularPrice ??
    entry.price?.regularPrice ??
    0;

  if (!name || !image) {
    return null;
  }

  const type = entry.bundle
    ? "Bundle"
    : primaryItem?.type?.displayValue ??
      primaryInstrument?.type?.displayValue ??
      (primaryTrack ? "Jam Track" : primaryLegoKit ? "LEGO Kit" : "Cosmetic");

  return {
    id: entry.offerId ?? primaryItem?.id ?? primaryInstrument?.id ?? primaryTrack?.id ?? name,
    name,
    type,
    image,
    rarity:
      primaryItem?.rarity?.displayValue ??
      primaryInstrument?.rarity?.displayValue ??
      primaryItem?.rarity?.value ??
      primaryInstrument?.rarity?.value ??
      (entry.bundle ? "Bundle" : "Unknown"),
    season:
      primaryItem?.introduction?.text ??
      (primaryItem?.introduction?.chapter && primaryItem?.introduction?.season
        ? `Chapter ${primaryItem.introduction.chapter}, Season ${primaryItem.introduction.season}`
        : "Unknown season"),
    price,
    category: categoryFromType(entry, primaryItem?.type?.value ?? primaryInstrument?.type?.value, type)
  };
}

export function groupShopItems(items: ShopItem[]) {
  return SHOP_CATEGORIES.map((category) => ({
    category,
    label: categoryLabels[category],
    items: items.filter((item) => item.category === category)
  })).filter((group) => group.items.length > 0);
}

export function proxiedImageUrl(imageUrl: string) {
  return imageUrl;
}
