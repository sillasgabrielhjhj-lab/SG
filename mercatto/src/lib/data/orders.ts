import "server-only";

import { prisma } from "@/lib/prisma";

export async function getOrdersForUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } } },
      payment: true,
      shipment: true,
    },
  });
}

export async function getOrderDetail(userId: string, orderNumber: string) {
  return prisma.order.findFirst({
    where: { orderNumber, userId },
    include: {
      items: {
        include: {
          product: { include: { images: { take: 1, orderBy: { position: "asc" } } } },
          seller: true,
          review: true,
        },
      },
      payment: true,
      shipment: true,
      shippingAddress: true,
      coupon: true,
    },
  });
}
