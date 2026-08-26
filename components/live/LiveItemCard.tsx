"use client";

import { memo, useState } from "react";
import type { LiveOverlaySettings } from "@/lib/live-overlay";
import { proxiedImageUrl, type ShopItem } from "@/lib/shop";

type LiveItemCardProps = {
  item: ShopItem;
  settings: LiveOverlaySettings;
};

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function itemInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function rarityTone(rarity: string) {
  const normalized = rarity.toLowerCase();

  if (normalized.includes("uncommon")) return "uncommon";
  if (normalized.includes("legendary")) return "legendary";
  if (normalized.includes("mythic")) return "mythic";
  if (normalized.includes("epic")) return "epic";
  if (normalized.includes("rare")) return "rare";
  if (normalized.includes("icon")) return "icon";
  if (normalized.includes("marvel")) return "marvel";
  if (normalized.includes("dc")) return "dc";
  if (normalized.includes("gaming legends")) return "gaming";
  if (normalized.includes("star wars")) return "star-wars";
  if (normalized.includes("lava")) return "lava";
  if (normalized.includes("shadow")) return "shadow";
  if (normalized.includes("slurp")) return "slurp";
  if (normalized.includes("dark")) return "dark";
  return "common";
}

export const LiveItemCard = memo(function LiveItemCard({ item, settings }: LiveItemCardProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageFailed = failedImage === item.image;
  const hasPrices = settings.showVbucks || settings.showBirr;
  const hasInformation =
    settings.showName || settings.showMeta || settings.showDescription || hasPrices;
  const isImageOnly = settings.showImage && !hasInformation;

  return (
    <article
      className={`live-item-card ${isImageOnly ? "live-item-card--image-only" : ""} ${!settings.showImage ? "live-item-card--text-only" : ""}`}
      data-category={item.category}
      data-item-id={item.id}
      data-live-item="true"
      data-orientation={settings.orientation}
      data-rarity-tone={rarityTone(item.rarity)}
    >
      {settings.showImage ? (
        <div className="live-item-card__art">
          {imageFailed ? (
            <div aria-label={`${item.name} image unavailable`} className="live-item-card__fallback">
              <strong>{itemInitials(item.name) || "ITEM"}</strong>
              <span>ITEM</span>
            </div>
          ) : (
            <img
              alt={item.name}
              className="h-full w-full object-contain"
              decoding="async"
              fetchPriority="auto"
              loading="eager"
              onError={() => setFailedImage(item.image)}
              src={proxiedImageUrl(item.image)}
            />
          )}
        </div>
      ) : null}

      {hasInformation ? (
        <div className="live-item-card__content">
          {settings.showMeta ? (
            <div className="live-item-card__meta">
              <span>{item.type}</span>
              <span>{item.rarity}</span>
            </div>
          ) : null}
          {settings.showName ? <h2 className="live-item-card__name">{item.name}</h2> : null}

          {settings.showDescription ? (
            <p className="live-item-card__description">{item.season}</p>
          ) : null}

          {hasPrices ? (
            <div className="live-item-card__prices">
              {settings.showVbucks ? (
                <strong className="live-item-card__vbucks text-cyan-200">
                  {formatNumber(item.price)} V-Bucks
                </strong>
              ) : null}
              {settings.showBirr ? (
                <strong
                  className="live-item-card__birr text-amber-200"
                  style={{ fontSize: `${settings.birrTextSize}%` }}
                >
                  {formatNumber(Math.round(item.price * settings.birrRate))} Birr
                </strong>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
});
