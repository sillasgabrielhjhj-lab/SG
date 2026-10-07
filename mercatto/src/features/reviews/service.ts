import "server-only";
import { db } from "@/server/db";
import { AppError, conflict, forbidden, notFound } from "@/server/errors";
import { audit } from "@/server/observability/audit";
import { recomputeProductAggregates } from "@/features/catalog/aggregates";
import { sanitizePlainText, screenText } from "@/features/moderation/filter";
import type { CreateReviewInput } from "@/features/reviews/schemas";

/** Recalcula a reputação (nota média) da loja a partir das avaliações publicadas. */
export async function recomputeStoreRating(storeId: string) {
  const agg = await db.review.aggregate({
    where: { status: "PUBLISHED", product: { storeId } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await db.store.update({
    where: { id: storeId },
    data: {
      ratingAvg: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
      ratingCount: agg._count._all,
    },
  });
}

/**
 * Cria avaliação de um item comprado e ENTREGUE. Apenas compradores podem
 * avaliar (selo "Compra verificada"). Textos sinalizados vão para moderação.
 */
export async function createReview(userId: string, input: CreateReviewInput) {
  const item = await db.orderItem.findUnique({
    where: { id: input.orderItemId },
    select: {
      id: true,
      productId: true,
      reviewed: true,
      order: { select: { userId: true, status: true, storeId: true } },
      review: { select: { id: true } },
    },
  });
  if (!item || item.order.userId !== userId) throw notFound("Item de pedido não encontrado.");
  if (item.order.status !== "DELIVERED") {
    throw new AppError("UNPROCESSABLE", "Você poderá avaliar assim que o pedido for entregue.");
  }
  if (item.reviewed || item.review) throw conflict("Você já avaliou este item.");

  const existing = await db.review.findUnique({
    where: { userId_productId: { userId, productId: item.productId } },
    select: { id: true },
  });
  if (existing) throw conflict("Você já avaliou este produto.");

  const title = input.title ? sanitizePlainText(input.title) : null;
  const comment = input.comment ? sanitizePlainText(input.comment) : null;
  const screening = screenText(`${title ?? ""}\n${comment ?? ""}`);

  const review = await db.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        productId: item.productId,
        userId,
        orderItemId: item.id,
        rating: input.rating,
        title,
        comment,
        photos: input.photos,
        videos: input.videos,
        isVerifiedPurchase: true,
        status: screening.flagged ? "PENDING" : "PUBLISHED",
        moderationNote: screening.flagged ? `Triagem automática: ${screening.reasons.join(", ")}` : null,
      },
      select: { id: true, status: true },
    });
    await tx.orderItem.update({ where: { id: item.id }, data: { reviewed: true } });
    return created;
  });

  await recomputeProductAggregates([item.productId]);
  await recomputeStoreRating(item.order.storeId);
  return review;
}

export async function moderateReview(
  actorId: string,
  input: { reviewId: string; status: "PUBLISHED" | "REJECTED" | "PENDING"; note?: string },
) {
  const review = await db.review.findUnique({
    where: { id: input.reviewId },
    select: { id: true, status: true, productId: true, product: { select: { storeId: true } } },
  });
  if (!review) throw notFound("Avaliação não encontrada.");
  await db.review.update({
    where: { id: review.id },
    data: { status: input.status, moderationNote: input.note ?? null },
  });
  await audit({
    actorId,
    action: "review.moderated",
    entityType: "Review",
    entityId: review.id,
    before: { status: review.status },
    after: { status: input.status, note: input.note ?? null },
  });
  await recomputeProductAggregates([review.productId]);
  await recomputeStoreRating(review.product.storeId);
}

/** Usuário só pode excluir a própria avaliação. */
export async function deleteOwnReview(userId: string, reviewId: string) {
  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { userId: true, productId: true, orderItemId: true, product: { select: { storeId: true } } },
  });
  if (!review) throw notFound("Avaliação não encontrada.");
  if (review.userId !== userId) throw forbidden();
  await db.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: reviewId } });
    if (review.orderItemId) await tx.orderItem.update({ where: { id: review.orderItemId }, data: { reviewed: false } });
  });
  await recomputeProductAggregates([review.productId]);
  await recomputeStoreRating(review.product.storeId);
}
