import { proxiedImageUrl, type ShopItem } from "@/lib/shop";

type ShopCardProps = {
  item: ShopItem;
  birrPerVbuck: number;
  compact: boolean;
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

export function ShopCard({ item, birrPerVbuck, compact, screenshotFields }: ShopCardProps) {
  const birrCost = item.price * birrPerVbuck;
  const hasPrices = screenshotFields.vbucks || screenshotFields.birr;

  return (
    <article className="overflow-hidden rounded-md border border-white/10 bg-slate-950/75 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
      <div className="relative grid aspect-square place-items-center bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.22),transparent_35%),linear-gradient(145deg,rgba(30,41,59,0.95),rgba(2,6,23,0.96))]">
        <img
          alt={item.name}
          className="h-full w-full object-contain p-2 drop-shadow-2xl"
          crossOrigin="anonymous"
          decoding="async"
          fetchPriority="low"
          loading="lazy"
          src={proxiedImageUrl(item.image)}
        />
        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-[9px] font-black uppercase tracking-normal text-cyan-100">
          {item.rarity}
        </span>
      </div>

      <div className={compact ? "grid gap-1 p-2" : "grid gap-2 p-2"}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-normal text-slate-400">{item.type}</p>
          <h3 className={compact ? "line-clamp-2 min-h-8 text-[11px] font-black leading-tight text-white" : "line-clamp-2 min-h-9 text-xs font-black leading-tight text-white"}>
            {item.name}
          </h3>
          {screenshotFields.description ? (
            <p className={compact ? "mt-1 line-clamp-1 text-[10px] font-semibold text-slate-400" : "mt-1 line-clamp-1 text-[11px] font-semibold text-slate-400"}>
              {item.season}
            </p>
          ) : null}
        </div>

        {hasPrices ? (
          <div className={compact ? "grid gap-1 rounded bg-white/[0.06] p-1.5 text-[10px]" : "grid gap-1 rounded bg-white/[0.06] p-2 text-[11px]"}>
            {screenshotFields.vbucks ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300">{compact ? "VB" : "V-Bucks"}</span>
                <strong className="text-cyan-200">{formatNumber(item.price)}</strong>
              </div>
            ) : null}
            {screenshotFields.birr ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300">{compact ? "Birr" : "Birr cost"}</span>
                <strong className="text-amber-200">{formatNumber(birrCost)}{compact ? "" : " Birr"}</strong>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
