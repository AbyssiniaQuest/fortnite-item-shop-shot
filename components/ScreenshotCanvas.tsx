import { CategorySection } from "@/components/CategorySection";
import type { ShopCategory, ShopItem } from "@/lib/shop";

type ShopGroup = {
  category: ShopCategory;
  label: string;
  items: ShopItem[];
};

type ScreenshotCanvasProps = {
  groups: ShopGroup[];
  birrPerVbuck: number;
  columns: number;
  compact: boolean;
  screenshotFields: {
    birr: boolean;
    vbucks: boolean;
    description: boolean;
  };
};

export function ScreenshotCanvas({
  groups,
  birrPerVbuck,
  columns,
  compact,
  screenshotFields
}: ScreenshotCanvasProps) {
  return (
    <div className="w-full bg-slate-950 text-white">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#020617_0%,#111827_44%,#171717_100%)] p-3 sm:p-5">
        {groups.length > 0 ? (
          <div className="grid gap-3">
            {groups.map((group) => (
              <CategorySection
                birrPerVbuck={birrPerVbuck}
                category={group.category}
                compact={compact}
                columns={columns}
                items={group.items}
                key={group.category}
                label={group.label}
                screenshotFields={screenshotFields}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-8 text-center text-slate-300">
            No matching shop items for the selected filters.
          </div>
        )}
      </div>
    </div>
  );
}
