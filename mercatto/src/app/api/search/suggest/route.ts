import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/request";
import { popularSearches, suggest } from "@/features/search/suggest";

export const GET = apiRoute(async (request) => {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  await enforceRateLimit(`suggest:${await getClientIp()}`, 120, 60);
  if (q.length > 80) return NextResponse.json({ terms: [], categories: [], products: [] });
  const data = q.length < 2 ? { terms: await popularSearches(), categories: [], products: [] } : await suggest(q);
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
});
