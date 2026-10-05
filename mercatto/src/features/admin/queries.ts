import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/server/db";

const PAGE = 25;
const pageOf = (p?: number) => Math.max(1, p ?? 1);

export async function listCategoriesAdmin() {
  return db.category.findMany({
    orderBy: [{ parentId: "asc" }, { position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true, children: true } }, attributes: { orderBy: { position: "asc" } } },
  });
}

export async function listBrandsAdmin(q?: string) {
  return db.brand.findMany({ where: q ? { name: { contains: q, mode: "insensitive" } } : {}, orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
}

export async function listBannersAdmin() {
  return db.banner.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }] });
}

export async function listUsersAdmin(filters: { q?: string; role?: Role; page?: number } = {}) {
  const page = pageOf(filters.page);
  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.q ? { OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { email: { contains: filters.q.toLowerCase() } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, lastLoginAt: true, isDemo: true, emailVerifiedAt: true, _count: { select: { orders: true } }, store: { select: { name: true, slug: true } } },
    }),
    db.user.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function getCustomerAdmin(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, status: true, phone: true, createdAt: true, lastLoginAt: true, emailVerifiedAt: true,
      addresses: true,
      orders: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, number: true, status: true, totalCents: true, createdAt: true } },
    },
  });
}

export async function listStoresAdmin(filters: { status?: "PENDING" | "ACTIVE" | "SUSPENDED"; q?: string; page?: number } = {}) {
  const page = pageOf(filters.page);
  const where: Prisma.StoreWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    db.store.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { id: true, name: true, slug: true, status: true, isOfficial: true, document: true, originState: true, ratingAvg: true, ratingCount: true, salesCount: true, cancelledCount: true, createdAt: true, owner: { select: { name: true, email: true } }, _count: { select: { products: true } } },
    }),
    db.store.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function listPaymentsAdmin(filters: { status?: string; method?: "PIX" | "CREDIT_CARD"; page?: number } = {}) {
  const page = pageOf(filters.page);
  const where: Prisma.PaymentWhereInput = {
    ...(filters.status ? { status: filters.status as Prisma.PaymentWhereInput["status"] } : {}),
    ...(filters.method ? { method: filters.method } : {}),
  };
  const [items, total, byStatus] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { id: true, provider: true, providerPaymentId: true, method: true, status: true, amountCents: true, refundedCents: true, installments: true, isSandbox: true, failureReason: true, createdAt: true, paidAt: true, checkout: { select: { user: { select: { name: true, email: true } }, orders: { select: { id: true, number: true } } } } },
    }),
    db.payment.count({ where }),
    db.payment.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountCents: true } }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)), byStatus };
}

export async function listAuditLogs(filters: { entityType?: string; action?: string; page?: number } = {}) {
  const page = pageOf(filters.page);
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action ? { action: { startsWith: filters.action } } : {}),
  };
  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { name: true, email: true } } } }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}
