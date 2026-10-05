import "server-only";
import { db } from "@/server/db";
import { getStoreSettings } from "@/features/settings/queries";
import { dailySalesSeries, lowStockVariants, percentChange, periodRange, salesTotals, topProducts, visitsTotal, type MetricsPeriod } from "@/features/metrics/core";

/** Dashboard do vendedor (escopo: storeId). */
export async function getSellerDashboard(storeId: string, days: MetricsPeriod = 30) {
  const { start, end, prevStart } = periodRange(days);
  const settings = await getStoreSettings();
  const [current, previous, visits, prevVisits, series, top, lowStock, recentOrders, toShip, unanswered, store] = await Promise.all([
    salesTotals({ storeId, start, end }),
    salesTotals({ storeId, start: prevStart, end: start }),
    visitsTotal({ storeId, start, end }),
    visitsTotal({ storeId, start: prevStart, end: start }),
    dailySalesSeries({ storeId, start, end }),
    topProducts({ storeId, start, end, take: 5 }),
    lowStockVariants({ storeId, threshold: settings.lowStockThreshold, take: 8 }),
    db.order.findMany({ where: { storeId, status: { not: "PENDING_PAYMENT" } }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, number: true, status: true, totalCents: true, createdAt: true, user: { select: { name: true } }, _count: { select: { items: true } } } }),
    db.order.count({ where: { storeId, status: { in: ["PAID", "PROCESSING"] } } }),
    db.question.count({ where: { product: { storeId }, status: "PUBLISHED", answer: { is: null } } }),
    db.store.findUnique({ where: { id: storeId }, select: { name: true, status: true, ratingAvg: true, ratingCount: true, salesCount: true, cancelledCount: true, isOfficial: true, slug: true } }),
  ]);
  const conversion = visits ? current.orders / visits : 0;
  const prevConversion = prevVisits ? previous.orders / prevVisits : 0;
  return {
    period: days,
    store,
    kpis: {
      revenue: { value: current.revenueCents, change: percentChange(current.revenueCents, previous.revenueCents) },
      orders: { value: current.orders, change: percentChange(current.orders, previous.orders) },
      avgTicket: { value: current.avgTicketCents, change: percentChange(current.avgTicketCents, previous.avgTicketCents) },
      units: { value: current.unitsSold, change: percentChange(current.unitsSold, previous.unitsSold) },
      visits: { value: visits, change: percentChange(visits, prevVisits) },
      conversion: { value: conversion, change: percentChange(Math.round(conversion * 10000), Math.round(prevConversion * 10000)) },
    },
    series,
    topProducts: top,
    lowStock,
    recentOrders,
    pending: { toShip, unanswered },
  };
}

/** Dashboard executivo da plataforma. */
export async function getAdminDashboard(days: MetricsPeriod = 30) {
  const { start, end, prevStart } = periodRange(days);
  const settings = await getStoreSettings();
  const officialStore = await db.store.findFirst({ where: { isOfficial: true }, select: { id: true } });
  const [gmv, prevGmv, official, visits, prevVisits, series, top, lowStock, customers, newCustomers, sellers, pendingStores, products, outOfStock, paymentsByStatus, paymentsByMethod, refunds, couponUse, activeCampaigns, failedPayments24h, pendingReviews, pendingQuestions, webhookErrors, categoryRevenue] = await Promise.all([
    salesTotals({ start, end }),
    salesTotals({ start: prevStart, end: start }),
    officialStore ? salesTotals({ storeId: officialStore.id, start, end }) : Promise.resolve(null),
    visitsTotal({ start, end }),
    visitsTotal({ start: prevStart, end: start }),
    dailySalesSeries({ start, end }),
    topProducts({ start, end, take: 8 }),
    lowStockVariants({ storeId: officialStore?.id, threshold: settings.lowStockThreshold, take: 8 }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: start } } }),
    db.store.count({ where: { status: "ACTIVE", isOfficial: false } }),
    db.store.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: "OUT_OF_STOCK" } }),
    db.payment.groupBy({ by: ["status"], where: { createdAt: { gte: start } }, _count: { _all: true }, _sum: { amountCents: true } }),
    db.payment.groupBy({ by: ["method"], where: { status: "PAID", paidAt: { gte: start } }, _count: { _all: true }, _sum: { amountCents: true } }),
    db.refund.aggregate({ where: { createdAt: { gte: start } }, _count: { _all: true }, _sum: { amountCents: true } }),
    db.couponRedemption.aggregate({ where: { createdAt: { gte: start } }, _count: { _all: true }, _sum: { discountCents: true } }),
    db.campaign.count({ where: { isActive: true, startsAt: { lte: end }, endsAt: { gt: end } } }),
    db.payment.count({ where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.question.count({ where: { status: "PENDING" } }),
    db.webhookEvent.count({ where: { processedAt: null, error: { not: null } } }),
    db.$queryRaw<{ name: string; revenue: bigint }[]>`
      SELECT COALESCE(root."name", c."name") AS name, SUM(oi."totalCents") AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Product" p ON p."id" = oi."productId"
      JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "Category" root ON root."id" = c."parentId"
      WHERE o."paidAt" >= ${start} AND o."status"::text NOT IN ('CANCELLED', 'REFUNDED', 'PENDING_PAYMENT')
      GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
  ]);
  const conversion = visits ? gmv.orders / visits : 0;
  return {
    period: days,
    kpis: {
      gmv: { value: gmv.revenueCents, change: percentChange(gmv.revenueCents, prevGmv.revenueCents) },
      officialRevenue: { value: official?.revenueCents ?? 0 },
      orders: { value: gmv.orders, change: percentChange(gmv.orders, prevGmv.orders) },
      avgTicket: { value: gmv.avgTicketCents, change: percentChange(gmv.avgTicketCents, prevGmv.avgTicketCents) },
      customers: { value: customers, newInPeriod: newCustomers },
      sellers: { value: sellers, pending: pendingStores },
      conversion: { value: conversion, visits, prevVisits },
      products: { active: products, outOfStock },
    },
    series,
    topProducts: top,
    categoryRevenue: categoryRevenue.map((c) => ({ name: c.name, revenueCents: Number(c.revenue) })),
    lowStock,
    payments: {
      byStatus: paymentsByStatus.map((p) => ({ status: p.status, count: p._count._all, amountCents: p._sum.amountCents ?? 0 })),
      byMethod: paymentsByMethod.map((p) => ({ method: p.method, count: p._count._all, amountCents: p._sum.amountCents ?? 0 })),
    },
    refunds: { count: refunds._count._all, amountCents: refunds._sum.amountCents ?? 0 },
    coupons: { redemptions: couponUse._count._all, discountCents: couponUse._sum.discountCents ?? 0 },
    activeCampaigns,
    alerts: { pendingStores, failedPayments24h, pendingReviews, pendingQuestions, webhookErrors, lowStock: lowStock.length, outOfStock },
  };
}
