import "server-only";
import { headers } from "next/headers";
import { env } from "@/server/env";
import { forbidden } from "@/server/errors";

/** IP do cliente (Vercel define x-forwarded-for / x-real-ip). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function getUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent")?.slice(0, 300) ?? null;
}

/**
 * Proteção CSRF para Route Handlers que mudam estado: exige que Origin
 * (ou Referer) pertença ao próprio host. Server Actions já fazem essa
 * verificação nativamente no Next.js.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) throw forbidden("Origem da requisição ausente.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Origem da requisição inválida.");
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const allowed = new Set([host, new URL(env.APP_URL).host].filter(Boolean));
  if (!allowed.has(originHost)) throw forbidden("Origem da requisição não permitida.");
}
