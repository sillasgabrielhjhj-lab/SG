import "server-only";
import { db } from "@/server/db";
import { logger } from "@/server/observability/logger";
import { recomputeProductAggregates } from "@/features/catalog/aggregates";
import { getCategoryWithDescendantIds } from "@/features/catalog/categories.server";

/**
 * Sincroniza o status persistido das promoções com as datas/estoque
 * promocional e recalcula os preços desnormalizados dos produtos afetados.
 * Idempotente. Chamado pelo cron e, de forma limitada, pelas páginas públicas.
 */
export async function syncPromotionStatuses(now: Date = new Date()) {
  const toActivate = await db.promotion.findMany({ where: { status: "SCHEDULED", startsAt: { lte: now }, endsAt: { gt: now } }, select: { id: true } });
  const toExpire = await db.promotion.findMany({
    where: { status: { in: ["SCHEDULED", "ACTIVE"] }, endsAt: { lte: now } },
    select: { id: true },
  });
  const soldOut = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Promotion" WHERE "status" = 'ACTIVE' AND "stockLimit" IS NOT NULL AND "soldCount" >= "stockLimit"`;

  const changed = [...toActivate, ...toExpire, ...soldOut].map((p) => p.id);
  if (toActivate.length) await db.promotion.updateMany({ where: { id: { in: toActivate.map((p) => p.id) } }, data: { status: "ACTIVE" } });
  const expireIds = [...toExpire, ...soldOut].map((p) => p.id);
  if (expireIds.length) await db.promotion.updateMany({ where: { id: { in: expireIds } }, data: { status: "EXPIRED" } });

  if (changed.length) {
    const promos = await db.promotion.findMany({ where: { id: { in: changed } }, select: { storeId: true, categoryIds: true, items: { select: { productId: true } } } });
    const productIds = new Set(promos.flatMap((p) => p.items.map((i) => i.productId)));
    for (const p of promos.filter((x) => x.categoryIds.length)) {
      const cats = (await Promise.all(p.categoryIds.map((c) => getCategoryWithDescendantIds(c)))).flat();
      const rows = await db.product.findMany({ where: { categoryId: { in: cats }, ...(p.storeId ? { storeId: p.storeId } : {}) }, select: { id: true }, take: 5000 });
      rows.forEach((r) => productIds.add(r.id));
    }
    const ids = [...productIds];
    for (let i = 0; i < ids.length; i += 200) await recomputeProductAggregates(ids.slice(i, i + 200));
  }
  return { activated: toActivate.length, expired: expireIds.length };
}

let lastRun = 0;
let running: Promise<unknown> | null = null;

/** Versão com limite de frequência (1x/min por instância) para chamar via after() nas páginas. */
export async function maybeSyncPromotions() {
  if (running || Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  running = syncPromotionStatuses()
    .catch((error) => logger.warn("promotions.sync_failed", { error }))
    .finally(() => {
      running = null;
    });
  await running;
}
