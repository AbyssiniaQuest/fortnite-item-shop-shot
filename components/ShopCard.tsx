import { proxiedImageUrl, type ShopItem } from "@/lib/shop";

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
    maximumFractionDigits: 0
  }).format(value);
}

export function ShopCard({ item, birrPerVbuck, screenshotFields }: ShopCardProps) {
  const birrCost = item.price * birrPerVbuck;
  const hasPrices = screenshotFields.vbucks || screenshotFields.birr;

  return (
    <article className="shop-card overflow-hidden rounded border border-white/10 bg-slate-950/75 shadow-[0_8px_18px_rgba(0,0,0,0.22)]">
      <div className="shop-card__image grid aspect-square place-items-center bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.22),transparent_35%),linear-gradient(145deg,rgba(30,41,59,0.95),rgba(2,6,23,0.96))]">
        <img
          alt={item.name}
          className="h-full w-full object-contain drop-shadow-2xl"
          crossOrigin="anonymous"
          decoding="async"
          fetchPriority="low"
          loading="lazy"
          src={proxiedImageUrl(item.image)}
        />
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
              <strong className="truncate text-cyan-200">{formatNumber(item.price)} V-Bucks</strong>
            ) : null}
            {screenshotFields.birr ? (
              <strong className="truncate text-amber-200">{formatNumber(birrCost)} Birr</strong>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
