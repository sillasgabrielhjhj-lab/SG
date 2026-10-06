import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/request";
import { recommendProducts } from "@/features/recommendations/service";

const isId = (s: string) => /^[a-z0-9]{10,40}$/i.test(s);
const ids = (raw: string | null, max: number) => (raw ?? "").split(",").map((s) => s.trim()).filter(isId).slice(0, max);

/**
 * Recomendações a partir de sinais locais do navegador (vistos e buscas).
 * Somente leitura; sinais inválidos são descartados.
 */
export const GET = apiRoute(async (request) => {
  await enforceRateLimit(`recommend:${await getClientIp()}`, 60, 60);
  const params = new URL(request.url).searchParams;
  const terms = params
    .getAll("q")
    .map((t) => t.trim().slice(0, 60))
    .filter((t) => t.length >= 2)
    .slice(0, 5);
  const result = await recommendProducts({ viewed: ids(params.get("viewed"), 20), exclude: ids(params.get("exclude"), 80), terms });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=60" } });
});
