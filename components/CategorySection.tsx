import { ShopCard } from "@/components/ShopCard";
import type { ShopCategory, ShopItem } from "@/lib/shop";

type CategorySectionProps = {
  category: ShopCategory;
  label: string;
  items: ShopItem[];
  birrPerVbuck: number;
  columns: number;
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

export function CategorySection({ category, label, items, birrPerVbuck, columns }: CategorySectionProps) {
  return (
    <section className="break-inside-avoid rounded-lg border border-white/10 bg-white/[0.045] p-3 shadow-2xl shadow-black/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`bg-gradient-to-r ${categoryAccent[category]} bg-clip-text text-base font-black uppercase tracking-normal text-transparent`}
          >
            {label}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-bold text-slate-200">
          {items.length}
        </span>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(130px, 1fr))` }}
      >
        {items.map((item) => (
          <ShopCard birrPerVbuck={birrPerVbuck} item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}
