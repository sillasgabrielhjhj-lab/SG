import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** Status considerados "venda efetivada" para métricas (pagos e posteriores, exceto cancelados/reembolsados). */
export const SOLD_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export type MetricsPeriod = 7 | 30 | 90;

export function periodRange(days: MetricsPeriod, now = new Date()) {
  const end = now;
  const start = new Date(now.getTime() - days * 24 * 3600_000);
  const prevStart = new Date(start.getTime() - days * 24 * 3600_000);
  return { start, end, prevStart };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

type SeriesRow = { day: Date; revenue: bigint | number | null; orders: bigint | number };

/** Série diária (fuso de Brasília) de faturamento e pedidos, preenchendo dias sem venda. */
export async function dailySalesSeries(opts: { storeId?: string; start: Date; end: Date }) {
  const storeFilter = opts.storeId ? Prisma.sql`AND o."storeId" = ${opts.storeId}` : Prisma.empty;
  const rows = await db.$queryRaw<SeriesRow[]>`
    SELECT date_trunc('day', o."paidAt" AT TIME ZONE 'America/Sao_Paulo') AS day,
           SUM(o."totalCents") AS revenue,
           COUNT(*) AS orders
    FROM "Order" o
    WHERE o."paidAt" >= ${opts.start} AND o."paidAt" < ${opts.end}
      AND o."status"::text IN (${Prisma.join([...SOLD_STATUSES])})
      ${storeFilter}
    GROUP BY 1
    ORDER BY 1
  `;
  const byDay = new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), r]));
  const out: { date: string; revenueCents: number; orders: number }[] = [];
  const cursor = new Date(opts.start.getTime() - 3 * 3600_000);
  const last = new Date(opts.end.getTime() - 3 * 3600_000);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    const row = byDay.get(key);
    out.push({ date: key, revenueCents: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export async function salesTotals(opts: { storeId?: string; start: Date; end: Date }) {
  const where: Prisma.OrderWhereInput = {
    paidAt: { gte: opts.start, lt: opts.end },
    status: { in: [...SOLD_STATUSES] },
    ...(opts.storeId ? { storeId: opts.storeId } : {}),
  };
  const [agg, units] = await Promise.all([
    db.order.aggregate({ where, _sum: { totalCents: true, discountCents: true, shippingCents: true }, _count: { _all: true } }),
    db.orderItem.aggregate({ where: { order: where }, _sum: { quantity: true } }),
  ]);
  const revenue = agg._sum.totalCents ?? 0;
  const orders = agg._count._all;
  return {
    revenueCents: revenue,
    orders,
    avgTicketCents: orders ? Math.round(revenue / orders) : 0,
    unitsSold: units._sum.quantity ?? 0,
    discountCents: agg._sum.discountCents ?? 0,
    shippingCents: agg._sum.shippingCents ?? 0,
  };
}

export async function visitsTotal(opts: { storeId?: string; start: Date; end: Date }) {
  const agg = await db.productDailyStat.aggregate({
    where: { day: { gte: opts.start, lt: opts.end }, ...(opts.storeId ? { product: { storeId: opts.storeId } } : {}) },
    _sum: { views: true },
  });
  return agg._sum.views ?? 0;
}

export async function topProducts(opts: { storeId?: string; start: Date; end: Date; take?: number }) {
  const rows = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: { paidAt: { gte: opts.start, lt: opts.end }, status: { in: [...SOLD_STATUSES] }, ...(opts.storeId ? { storeId: opts.storeId } : {}) },
    },
    _sum: { quantity: true, totalCents: true },
    orderBy: { _sum: { totalCents: "desc" } },
    take: opts.take ?? 5,
  });
  const products = await db.product.findMany({
    where: { id: { in: rows.map((r) => r.productId) } },
    select: { id: true, name: true, slug: true, totalStock: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return rows.map((r) => ({
    productId: r.productId,
    name: byId.get(r.productId)?.name ?? "Produto removido",
    slug: byId.get(r.productId)?.slug ?? null,
    imageUrl: byId.get(r.productId)?.images[0]?.url ?? null,
    stock: byId.get(r.productId)?.totalStock ?? 0,
    units: r._sum.quantity ?? 0,
    revenueCents: r._sum.totalCents ?? 0,
  }));
}

/** Variantes com estoque igual ou abaixo do mínimo (ou do limite global). */
export async function lowStockVariants(opts: { storeId?: string; threshold: number; take?: number }) {
  const storeFilter = opts.storeId ? Prisma.sql`AND p."storeId" = ${opts.storeId}` : Prisma.empty;
  return db.$queryRaw<{ variantId: string; sku: string; variantName: string; stock: number; minStock: number; productId: string; productName: string; storeName: string }[]>`
    SELECT v."id" AS "variantId", v."sku", v."name" AS "variantName", v."stock", v."minStock",
           p."id" AS "productId", p."name" AS "productName", s."name" AS "storeName"
    FROM "ProductVariant" v
    JOIN "Product" p ON p."id" = v."productId"
    JOIN "Store" s ON s."id" = p."storeId"
    WHERE v."status" = 'ACTIVE'
      AND p."status" IN ('ACTIVE', 'OUT_OF_STOCK', 'PAUSED')
      AND v."stock" <= GREATEST(v."minStock", ${opts.threshold})
      ${storeFilter}
    ORDER BY v."stock" ASC, p."salesCount" DESC
    LIMIT ${opts.take ?? 10}
  `;
}
