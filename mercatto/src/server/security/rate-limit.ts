import "server-only";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

/**
 * Rate limit de janela fixa persistido no PostgreSQL — funciona entre
 * múltiplas instâncias serverless sem infraestrutura extra.
 * Para tráfego muito alto, troque por Redis (Upstash) mantendo a interface.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  // Upsert atômico: reinicia a janela quando expirada, senão incrementa.
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const row = rows[0]!;
  const remaining = Math.max(0, limit - row.count);
  return { allowed: row.count <= limit, remaining, resetAt: row.resetAt };
}

/** Lança AppError(RATE_LIMITED) quando o limite é excedido. */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const result = await rateLimit(key, limit, windowSeconds);
  if (!result.allowed) {
    const seconds = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
    throw new AppError("RATE_LIMITED", `Muitas tentativas. Tente novamente em ${seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)} min`}.`);
  }
  return result;
}

/** Limpeza periódica (cron). */
export async function purgeExpiredRateLimits() {
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
}
