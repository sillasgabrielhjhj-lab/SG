import "server-only";
import { db } from "@/server/db";
import type { ReviewStatus } from "@/generated/prisma/enums";

const PAGE = 20;

/** Avaliações feitas pelo usuário (área "Minhas avaliações"). */
export async function listUserReviews(userId: string, page = 1) {
  const where = { userId };
  const [items, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        photos: true,
        videos: true,
        status: true,
        isDemo: true,
        createdAt: true,
        product: { select: { name: true, slug: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } },
      },
    }),
    db.review.count({ where }),
  ]);
  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

/** Itens entregues ainda não avaliados — convite "Avalie sua compra". */
export async function listPendingReviewItems(userId: string) {
  return db.orderItem.findMany({
    where: { reviewed: false, order: { userId, status: "DELIVERED" } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      productName: true,
      variantName: true,
      imageUrl: true,
      createdAt: true,
      product: { select: { slug: true } },
      order: { select: { number: true, deliveredAt: true } },
    },
  });
}

export async function listReviewsForModeration(filters: { status?: ReviewStatus; page?: number; q?: string }) {
  const page = Math.max(1, filters.page ?? 1);
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { comment: { contains: filters.q, mode: "insensitive" as const } },
            { product: { name: { contains: filters.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        photos: true,
        videos: true,
        status: true,
        moderationNote: true,
        isDemo: true,
        isVerifiedPurchase: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        product: { select: { name: true, slug: true, store: { select: { name: true } } } },
      },
    }),
    db.review.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

/** Avaliações dos produtos de uma loja (painel do vendedor). */
export async function listStoreReviews(storeId: string, filters: { page?: number; rating?: number } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where = {
    status: "PUBLISHED" as const,
    product: { storeId },
    ...(filters.rating ? { rating: filters.rating } : {}),
  };
  const [items, total, distribution] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        photos: true,
        videos: true,
        isDemo: true,
        isVerifiedPurchase: true,
        createdAt: true,
        user: { select: { name: true } },
        product: { select: { name: true, slug: true } },
      },
    }),
    db.review.count({ where }),
    db.review.groupBy({ by: ["rating"], where: { status: "PUBLISHED", product: { storeId } }, _count: { _all: true } }),
  ]);
  const dist = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: distribution.find((d) => d.rating === r)?._count._all ?? 0 }));
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)), distribution: dist };
}
