import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["fortnite-api.com", "cdn.fortnite-api.com", "images.fortnite-api.com"]);

export const revalidate = 86400;

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing image URL." }, { status: 400 });
  }

  try {
    const imageUrl = new URL(rawUrl);

    if (imageUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(imageUrl.hostname)) {
      return NextResponse.json({ error: "Image host is not allowed." }, { status: 400 });
    }

    const response = await fetch(imageUrl, {
      next: { revalidate },
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*"
      }
    });

    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "Unable to fetch image." }, { status: 502 });
    }

    return new NextResponse(response.body, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "Content-Type": response.headers.get("Content-Type") ?? "image/png"
      }
    });
  } catch {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }
}
