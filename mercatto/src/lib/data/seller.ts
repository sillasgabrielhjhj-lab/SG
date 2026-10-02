import "server-only";

import { prisma } from "@/lib/prisma";

export async function getSellerByUserId(userId: string) {
  return prisma.seller.findUnique({ where: { userId } });
}

export async function getSellerOverview(sellerId: string) {
  const [productCount, activeProductCount, pendingOrderItems, approvedItems, reviewCount] = await Promise.all([
    prisma.product.count({ where: { sellerId } }),
    prisma.product.count({ where: { sellerId, isActive: true } }),
    prisma.orderItem.count({
      where: { sellerId, order: { status: { in: ["PAYMENT_APPROVED", "PREPARING_SHIPMENT"] } } },
    }),
    prisma.orderItem.findMany({
      where: { sellerId, order: { status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] } } },
      select: { totalCents: true, quantity: true },
    }),
    prisma.review.count({ where: { product: { sellerId } } }),
  ]);

  const revenueCents = approvedItems.reduce((sum, item) => sum + item.totalCents, 0);
  const salesCount = approvedItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    productCount,
    activeProductCount,
    pendingOrderItems,
    revenueCents,
    salesCount,
    reviewCount,
  };
}

export async function getSellerProducts(sellerId: string, query?: string) {
  return prisma.product.findMany({
    where: {
      sellerId,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      images: { take: 1, orderBy: { position: "asc" } },
      inventory: true,
      category: true,
    },
  });
}

export async function getSellerProductForEdit(sellerId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, sellerId },
    include: {
      images: { orderBy: { position: "asc" } },
      attributes: true,
      variants: { include: { inventory: true } },
      inventory: true,
    },
  });
}

export async function getSellerOrders(sellerId: string) {
  const orders = await prisma.order.findMany({
    where: { items: { some: { sellerId } } },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      items: { where: { sellerId }, include: { product: { include: { images: { take: 1 } } } } },
      shipment: true,
    },
  });
  return orders;
}

export async function getSellerOrderDetail(sellerId: string, orderNumber: string) {
  const order = await prisma.order.findFirst({
    where: { orderNumber, items: { some: { sellerId } } },
    include: {
      user: { select: { name: true, email: true } },
      items: { where: { sellerId }, include: { product: { include: { images: { take: 1 } } } } },
      shippingAddress: true,
      shipment: true,
      payment: true,
    },
  });
  return order;
}

export async function getSellerReviews(sellerId: string) {
  return prisma.review.findMany({
    where: { product: { sellerId } },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
    take: 50,
  });
}
