import { ShopCard } from "@/components/ShopCard";
import type { CSSProperties } from "react";
import type { ShopCategory, ShopItem } from "@/lib/shop";

type CategorySectionProps = {
  category: ShopCategory;
  label: string;
  items: ShopItem[];
  birrPerVbuck: number;
  columns: number;
  screenshotFields: {
    birr: boolean;
    vbucks: boolean;
    description: boolean;
  };
};

export function CategorySection({
  category,
  label,
  items,
  birrPerVbuck,
  columns,
  screenshotFields,
}: CategorySectionProps) {
  return (
    <section className="shop-category" data-category={category}>
      <div className="shop-category-heading">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{label}</p>
        </div>
        <span className="text-xs text-zinc-400">{items.length}</span>
      </div>

      <div
        className="shop-item-grid"
        style={{ "--columns": String(columns) } as CSSProperties}
      >
        {items.map((item) => (
          <ShopCard
            birrPerVbuck={birrPerVbuck}
            item={item}
            key={item.id}
            screenshotFields={screenshotFields}
          />
        ))}
      </div>
    </section>
  );
}
