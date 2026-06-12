import { CategorySection } from "@/components/CategorySection";
import type { ShopCategory, ShopItem } from "@/lib/shop";

type ShopGroup = {
  category: ShopCategory;
  label: string;
  items: ShopItem[];
};

type ScreenshotCanvasProps = {
  groups: ShopGroup[];
  pageNumber?: number;
  pageTotal?: number;
  birrPerVbuck: number;
  updatedAt?: string;
  itemCount: number;
  activeFilterLabel?: string;
};

function formatDate(value?: string) {
  if (!value) {
    return "Loading today";
  }

  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function ScreenshotCanvas({
  groups,
  pageNumber,
  pageTotal,
  birrPerVbuck,
  updatedAt,
  itemCount,
  activeFilterLabel = "All shop categories"
}: ScreenshotCanvasProps) {
  return (
    <div className="w-[1080px] bg-slate-950 text-white">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#020617_0%,#111827_44%,#171717_100%)] p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300" />
        <div className="relative z-10 mb-6 grid gap-5 sm:grid-cols-[1fr_340px] sm:items-end">
          <div>
            <p className="mb-2 text-sm font-black uppercase tracking-normal text-cyan-200">
              Unofficial Fortnite Item Shop
            </p>
            <h1 className="text-6xl font-black leading-none tracking-normal">Shop Shot</h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-300">
              {formatDate(updatedAt)} snapshot with V-Bucks and Birr purchase-cost estimates.
            </p>
            <p className="mt-2 text-sm font-bold uppercase tracking-normal text-amber-200">
              {activeFilterLabel}
            </p>
          </div>

          <div className="grid gap-2 rounded-xl border border-white/10 bg-black/35 p-4 text-right">
            <span className="text-xs font-bold uppercase tracking-normal text-slate-400">Rate</span>
            <strong className="text-2xl text-amber-200">
              1 V-Buck = {birrPerVbuck.toLocaleString()} Birr
            </strong>
            <span className="text-sm text-slate-300">
              {itemCount.toLocaleString()} items{pageNumber ? ` - PNG ${pageNumber}/${pageTotal}` : ""}
            </span>
          </div>
        </div>

        {groups.length > 0 ? (
          <div className="grid gap-4">
            {groups.map((group) => (
              <CategorySection
                birrPerVbuck={birrPerVbuck}
                category={group.category}
                items={group.items}
                key={group.category}
                label={group.label}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-8 text-center text-slate-300">
            No matching shop items for the selected filters.
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-5 border-t border-white/10 pt-4 text-xs text-slate-400">
          <p>
            Unofficial fan-made generator. Not affiliated with, endorsed, sponsored, or approved by Epic Games.
          </p>
          <p>Data: Fortnite-API.com</p>
        </div>
      </div>
    </div>
  );
}
