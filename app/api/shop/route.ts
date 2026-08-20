import { NextResponse } from "next/server";
import { dedupeShopItems, mapShopEntry, SHOP_URL, type ShopResponse } from "@/lib/shop";

export const revalidate = 900;

export async function GET() {
  try {
    const response = await fetch(SHOP_URL, {
      next: { revalidate },
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Fortnite-API responded with ${response.status}`);
    }

    const payload = (await response.json()) as ShopResponse;
    const items = dedupeShopItems(
      (payload.data?.entries ?? [])
        .map(mapShopEntry)
        .filter((item): item is NonNullable<ReturnType<typeof mapShopEntry>> => Boolean(item))
    );

    return NextResponse.json(
      {
        source: SHOP_URL,
        updatedAt: payload.data?.date ?? new Date().toISOString(),
        cacheSeconds: revalidate,
        items
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Shop data is temporarily unavailable.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 502 }
    );
  }
}
