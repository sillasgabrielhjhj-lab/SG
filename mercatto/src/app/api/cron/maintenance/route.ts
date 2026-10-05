import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";
import { purgeExpiredSessions } from "@/server/auth/session";
import { purgeExpiredRateLimits } from "@/server/security/rate-limit";
import { expireStaleCheckouts } from "@/features/checkout/service";
import { purgeStaleGuestCarts } from "@/features/cart/service";
import { syncPromotionStatuses } from "@/features/promotions/sync.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  if (!env.CRON_SECRET) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Manutenção periódica (Vercel Cron envia Authorization: Bearer <CRON_SECRET>). */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const summary: Record<string, unknown> = {};
  const steps: [string, () => Promise<unknown>][] = [
    ["checkouts", () => expireStaleCheckouts()],
    ["promotions", () => syncPromotionStatuses()],
    ["sessions", () => purgeExpiredSessions()],
    ["rateLimits", () => purgeExpiredRateLimits()],
    ["guestCarts", () => purgeStaleGuestCarts()],
  ];
  for (const [name, step] of steps) {
    try {
      summary[name] = (await step()) ?? "ok";
    } catch (error) {
      logger.error("cron.step_failed", { step: name, error });
      summary[name] = "erro";
    }
  }
  return NextResponse.json({ ok: true, summary });
}
