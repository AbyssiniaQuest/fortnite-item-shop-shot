"use client";

import { useEffect, useState } from "react";
import type { LiveOverlaySettings } from "@/lib/live-overlay";
import { proxiedImageUrl, type ShopItem } from "@/lib/shop";

type LiveItemCardProps = {
  item: ShopItem;
  settings: LiveOverlaySettings;
  eager?: boolean;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function itemInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function LiveItemCard({ item, settings, eager = false }: LiveItemCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasPrices = settings.showVbucks || settings.showBirr;
  const hasInformation =
    settings.showName || settings.showMeta || settings.showDescription || hasPrices;
  const isImageOnly = settings.showImage && !hasInformation;

  useEffect(() => {
    setImageFailed(false);
  }, [item.image]);

  return (
    <article
      className={`live-item-card ${isImageOnly ? "live-item-card--image-only" : ""} ${!settings.showImage ? "live-item-card--text-only" : ""}`}
      data-category={item.category}
      data-live-item="true"
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
              fetchPriority={eager ? "high" : "auto"}
              loading={eager ? "eager" : "lazy"}
              onError={() => setImageFailed(true)}
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
                <strong className="text-cyan-200">{formatNumber(item.price)} V-Bucks</strong>
              ) : null}
              {settings.showBirr ? (
                <strong className="text-amber-200">
                  {formatNumber(Math.round(item.price * settings.birrRate))} Birr
                </strong>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
