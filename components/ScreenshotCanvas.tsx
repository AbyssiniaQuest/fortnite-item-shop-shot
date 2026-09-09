import { CategorySection } from "@/components/CategorySection";
import { memo } from "react";
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
  screenshotFields: {
    birr: boolean;
    vbucks: boolean;
    description: boolean;
  };
};

export const ScreenshotCanvas = memo(function ScreenshotCanvas({
  groups,
  birrPerVbuck,
  columns,
  screenshotFields,
}: ScreenshotCanvasProps) {
  return (
    <div className="w-full text-white">
      <div>
        {groups.length > 0 ? (
          <div className="shop-category-list">
            {groups.map((group) => (
              <CategorySection
                birrPerVbuck={birrPerVbuck}
                category={group.category}
                columns={columns}
                items={group.items}
                key={group.category}
                label={group.label}
                screenshotFields={screenshotFields}
              />
            ))}
          </div>
        ) : (
          <div className="shop-empty">
            No matching shop items for the selected filters.
          </div>
        )}
      </div>
    </div>
  );
});
