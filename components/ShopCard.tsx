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
    <article className="overflow-hidden rounded border border-white/10 bg-slate-950/75 shadow-[0_8px_18px_rgba(0,0,0,0.22)]">
      <div className="grid aspect-square place-items-center bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.22),transparent_35%),linear-gradient(145deg,rgba(30,41,59,0.95),rgba(2,6,23,0.96))]">
        <img
          alt={item.name}
          className={compact ? "h-full w-full object-contain p-0.5 drop-shadow-2xl sm:p-1" : "h-full w-full object-contain p-2 drop-shadow-2xl"}
          crossOrigin="anonymous"
          decoding="async"
          fetchPriority="low"
          loading="lazy"
          src={proxiedImageUrl(item.image)}
        />
      </div>

      <div className={compact ? "grid gap-0.5 p-1 sm:p-1.5" : "grid gap-2 p-2"}>
        <div>
          <div className={compact ? "flex items-center justify-between gap-1 text-[6px] font-black uppercase tracking-normal sm:text-[9px]" : "flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-normal"}>
            <span className="truncate text-slate-400">{item.type}</span>
            <span className="truncate text-cyan-100">{item.rarity}</span>
          </div>
          <h3 className={compact ? "line-clamp-2 min-h-5 text-[8px] font-black leading-tight text-white sm:min-h-7 sm:text-[10px]" : "line-clamp-2 min-h-9 text-xs font-black leading-tight text-white"}>
            {item.name}
          </h3>
          {screenshotFields.description ? (
            <p className={compact ? "mt-1 line-clamp-1 text-[10px] font-semibold text-slate-400" : "mt-1 line-clamp-1 text-[11px] font-semibold text-slate-400"}>
              {item.season}
            </p>
          ) : null}
        </div>

        {hasPrices ? (
          <div className={compact ? "grid gap-0.5 rounded bg-white/[0.06] px-1 py-0.5 text-[7px] leading-tight sm:text-[9px]" : "grid gap-1 rounded bg-white/[0.06] p-2 text-[11px]"}>
            {screenshotFields.vbucks ? (
              <div className={compact ? "text-cyan-200" : "flex items-center justify-between gap-2"}>
                {!compact ? <span className="text-slate-300">V-Bucks</span> : null}
                <strong className="text-cyan-200">{formatNumber(item.price)} V-Bucks</strong>
              </div>
            ) : null}
            {screenshotFields.birr ? (
              <div className={compact ? "text-amber-200" : "flex items-center justify-between gap-2"}>
                {!compact ? <span className="text-slate-300">Birr cost</span> : null}
                <strong className="text-amber-200">{formatNumber(birrCost)} Birr</strong>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
