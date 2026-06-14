import { ShopCard } from "@/components/ShopCard";
import type { CSSProperties } from "react";
import type { ShopCategory, ShopItem } from "@/lib/shop";

type CategorySectionProps = {
  category: ShopCategory;
  label: string;
  items: ShopItem[];
  birrPerVbuck: number;
  columns: number;
  compact: boolean;
  screenshotFields: {
    birr: boolean;
    vbucks: boolean;
    description: boolean;
  };
};

const categoryAccent: Record<ShopCategory, string> = {
  skins: "from-cyan-300 to-fuchsia-300",
  emotes: "from-lime-300 to-cyan-300",
  pickaxes: "from-orange-300 to-rose-300",
  kicks: "from-emerald-300 to-sky-300",
  bundles: "from-amber-300 to-fuchsia-300",
  gliders: "from-sky-300 to-indigo-300",
  wraps: "from-violet-300 to-cyan-300",
  backBlings: "from-teal-300 to-lime-300",
  jamTracks: "from-pink-300 to-amber-300",
  uncategorized: "from-slate-300 to-slate-100"
};

export function CategorySection({ category, label, items, birrPerVbuck, columns, compact, screenshotFields }: CategorySectionProps) {
  return (
    <section className="break-inside-avoid rounded-md border border-white/10 bg-white/[0.045] p-1.5 shadow-2xl shadow-black/20 sm:p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
        <div className="min-w-0">
          <p
            className={`bg-gradient-to-r ${categoryAccent[category]} bg-clip-text text-xs font-black uppercase tracking-normal text-transparent sm:text-sm`}
          >
            {label}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[10px] font-bold text-slate-200 sm:text-xs">
          {items.length}
        </span>
      </div>

      <div
        className="grid gap-1 sm:gap-2 [grid-template-columns:repeat(var(--columns),minmax(0,1fr))] sm:[grid-template-columns:repeat(var(--columns),minmax(130px,1fr))]"
        style={{ "--columns": String(columns) } as CSSProperties}
      >
        {items.map((item) => (
          <ShopCard
            birrPerVbuck={birrPerVbuck}
            compact={compact}
            item={item}
            key={item.id}
            screenshotFields={screenshotFields}
          />
        ))}
      </div>
    </section>
  );
}
