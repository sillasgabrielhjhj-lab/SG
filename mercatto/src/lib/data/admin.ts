import "server-only";

import { prisma } from "@/lib/prisma";

export async function getAdminOverview() {
  const [userCount, sellerCount, productCount, orderCount, revenue, pendingOrders] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.seller.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.aggregate({
      where: { status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] } },
      _sum: { totalCents: true },
    }),
    prisma.order.count({ where: { status: "AWAITING_PAYMENT" } }),
  ]);

  return {
    userCount,
    sellerCount,
    productCount,
    orderCount,
    revenueCents: revenue._sum.totalCents ?? 0,
    pendingOrders,
  };
}

export async function getAdminUsers(query?: string) {
  return prisma.user.findMany({
    where: query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getAdminSellers() {
  return prisma.seller.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } }, _count: { select: { products: true } } },
  });
}

export async function getAdminProducts(query?: string) {
  return prisma.product.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { images: { take: 1, orderBy: { position: "asc" } }, seller: true, category: true },
  });
}

export async function getAdminOrders() {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true } }, items: true },
  });
}

export async function getAdminCategories() {
  return prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: { parent: true, _count: { select: { products: true } } },
  });
}

export async function getAdminCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getAdminReviews() {
  return prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
  });
}
