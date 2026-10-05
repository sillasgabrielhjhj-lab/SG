import "server-only";
import type { OrderStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { allowedTransitions, buildOrderTimeline, RETURN_WINDOW_DAYS } from "@/features/orders/state-machine";

const PAGE = 15;

const LIST_SELECT = {
  id: true,
  number: true,
  status: true,
  totalCents: true,
  createdAt: true,
  paidAt: true,
  checkoutId: true,
  store: { select: { name: true, slug: true, isOfficial: true } },
  items: { take: 4, select: { productName: true, variantName: true, imageUrl: true, quantity: true } },
  shipment: { select: { status: true, trackingCode: true, estimatedDeliveryAt: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

export async function listCustomerOrders(userId: string, filters: { page?: number; status?: OrderStatus } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.OrderWhereInput = { userId, ...(filters.status ? { status: filters.status } : {}) };
  const [items, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: LIST_SELECT }),
    db.order.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

const DETAIL_SELECT = {
  id: true,
  number: true,
  status: true,
  subtotalCents: true,
  discountCents: true,
  shippingCents: true,
  totalCents: true,
  shippingAddress: true,
  shippingService: true,
  shippingEtaDays: true,
  customerNote: true,
  cancelReason: true,
  createdAt: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  checkoutId: true,
  userId: true,
  store: { select: { id: true, name: true, slug: true, isOfficial: true, contactEmail: true } },
  items: { select: { id: true, productId: true, productName: true, variantName: true, sku: true, imageUrl: true, unitPriceCents: true, originalPriceCents: true, quantity: true, discountCents: true, totalCents: true, reviewed: true, product: { select: { slug: true } } } },
  events: { orderBy: { createdAt: "asc" as const }, select: { status: true, note: true, createdAt: true } },
  shipment: true,
  refunds: { select: { amountCents: true, status: true, createdAt: true, reason: true } },
  checkout: {
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      installments: true,
      couponCode: true,
      expiresAt: true,
      payments: { orderBy: { createdAt: "desc" as const }, take: 1, select: { status: true, method: true, installments: true, amountCents: true, cardBrand: true, cardLast4: true, paidAt: true, isSandbox: true } },
    },
  },
} satisfies Prisma.OrderSelect;

function withExtras<T extends { status: OrderStatus; events: { status: OrderStatus; createdAt: Date; note: string | null }[]; deliveredAt: Date | null }>(order: T, role: "CUSTOMER" | "SELLER" | "ADMIN") {
  const timeline = buildOrderTimeline(order.status, order.events);
  const canReturn = order.status === "DELIVERED" && order.deliveredAt !== null && Date.now() - order.deliveredAt.getTime() <= RETURN_WINDOW_DAYS * 24 * 3600_000;
  return { ...order, timeline, allowedTransitions: allowedTransitions(order.status, role).filter((s) => role !== "CUSTOMER" || order.status !== "DELIVERED" || canReturn || s !== "REFUND_REQUESTED") };
}

export async function getCustomerOrder(userId: string, number: string) {
  const order = await db.order.findFirst({ where: { number, userId }, select: DETAIL_SELECT });
  if (!order) throw notFound("Pedido não encontrado.");
  return withExtras(order, "CUSTOMER");
}

export async function listStoreOrders(storeId: string, filters: { page?: number; status?: OrderStatus; q?: string } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.OrderWhereInput = {
    storeId,
    // Pedidos aguardando pagamento não aparecem como venda para o vendedor.
    status: filters.status ?? { not: "PENDING_PAYMENT" },
    ...(filters.q ? { OR: [{ number: { contains: filters.q.toUpperCase() } }, { user: { name: { contains: filters.q, mode: "insensitive" } } }] } : {}),
  };
  const [items, total, counts] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: { ...LIST_SELECT, user: { select: { name: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { storeId }, _count: { _all: true } }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<OrderStatus, number>> };
}

export async function getStoreOrder(storeId: string, orderId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, storeId }, select: { ...DETAIL_SELECT, user: { select: { name: true, email: true, phone: true } } } });
  if (!order) throw notFound("Pedido não encontrado.");
  return withExtras(order, "SELLER");
}

export async function listAllOrders(filters: { page?: number; status?: OrderStatus; q?: string; storeId?: string } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.storeId ? { storeId: filters.storeId } : {}),
    ...(filters.q ? { OR: [{ number: { contains: filters.q.toUpperCase() } }, { user: { email: { contains: filters.q.toLowerCase() } } }, { user: { name: { contains: filters.q, mode: "insensitive" } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: { ...LIST_SELECT, user: { select: { name: true, email: true } } } }),
    db.order.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function getOrderAdmin(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { ...DETAIL_SELECT, user: { select: { id: true, name: true, email: true, phone: true } } } });
  if (!order) throw notFound("Pedido não encontrado.");
  return withExtras(order, "ADMIN");
}
