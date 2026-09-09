"use client";

import { memo, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { ShopItem } from "@/lib/shop";
import { previewImageUrl, shopAssetUrl } from "@/lib/shop-images";

type ShopCardProps = {
  item: ShopItem;
  birrPerVbuck: number;
  screenshotFields: {
    birr: boolean;
    vbucks: boolean;
    description: boolean;
  };
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export const ShopCard = memo(function ShopCard({
  item,
  birrPerVbuck,
  screenshotFields,
}: ShopCardProps) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [retryKey, setRetryKey] = useState(0);
  const preview = previewImageUrl(item);
  const source = [
    preview,
    shopAssetUrl(item.exportImage ?? item.image),
    item.image,
  ].find((candidate) => !failedSources.includes(candidate));
  const birrCost = item.price * birrPerVbuck;
  const hasPrices = screenshotFields.vbucks || screenshotFields.birr;

  return (
    <article className="shop-card" data-item-id={item.id}>
      <div className="shop-card__image">
        {!source ? (
          <button
            className="art-retry"
            title={`Retry artwork for ${item.name}`}
            aria-label={`Retry artwork for ${item.name}`}
            onClick={() => {
              setFailedSources([]);
              setRetryKey((value) => value + 1);
            }}
          >
            <RotateCcw />
          </button>
        ) : (
          <img
            key={`${source}-${retryKey}`}
            alt={item.name}
            className="h-full w-full object-contain"
            crossOrigin="anonymous"
            decoding="async"
            fetchPriority="auto"
            loading="lazy"
            src={source}
            width={256}
            height={256}
            onError={() =>
              setFailedSources((previous) => [...previous, source])
            }
          />
        )}
      </div>

      <div className="shop-card__body grid">
        <div>
          <div className="shop-card__meta flex items-center justify-between font-black uppercase tracking-normal">
            <span className="truncate text-slate-400">{item.type}</span>
            <span className="truncate text-cyan-100">{item.rarity}</span>
          </div>
          <h3 className="shop-card__name line-clamp-2 font-black text-white">
            {item.name}
          </h3>
          {screenshotFields.description ? (
            <p className="shop-card__description line-clamp-1 font-semibold text-slate-400">
              {item.season}
            </p>
          ) : null}
        </div>

        {hasPrices ? (
          <div className="shop-card__prices grid rounded bg-white/[0.06] font-black">
            {screenshotFields.vbucks ? (
              <strong className="truncate text-cyan-200">
                {formatNumber(item.price)} V-Bucks
              </strong>
            ) : null}
            {screenshotFields.birr ? (
              <strong className="truncate text-amber-200">
                {formatNumber(birrCost)} Birr
              </strong>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
});
