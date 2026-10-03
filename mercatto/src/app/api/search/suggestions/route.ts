import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSearchSuggestions } from "@/lib/data/catalog";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.slice(0, 100) ?? "";

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`search-suggest:${ip}`, 60, 60);
  if (!allowed) {
    return NextResponse.json({ items: [] }, { status: 429 });
  }

  if (!q.trim()) {
    return NextResponse.json({ items: [] });
  }

  const items = await getSearchSuggestions(q);
  return NextResponse.json({ items });
}
