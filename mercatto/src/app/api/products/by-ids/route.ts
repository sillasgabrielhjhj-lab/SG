import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { getProductCardsByIds } from "@/features/catalog/cards.server";

/** Cards por ids (máx. 20) — usado por "vistos recentemente". */
export const GET = apiRoute(async (request) => {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9]{10,40}$/i.test(s))
    .slice(0, 20);
  const cards = await getProductCardsByIds(ids, { preserveOrder: true });
  return NextResponse.json({ items: cards }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
});
