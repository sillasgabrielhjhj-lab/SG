"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { reviewSchema } from "@/lib/validation/review";
import type { ActionState } from "@/lib/actions/auth";

/**
 * Cria uma avaliação real, com verificação de compra do lado do servidor —
 * nunca confia em productId/rating soltos vindos do formulário. A única
 * forma de avaliar é ter um OrderItem ENTREGUE desse produto, pertencente
 * a quem está logado, e que ainda não tenha avaliação (Review.orderItemId
 * é @unique no schema, então o banco também barraria uma segunda escrita
 * pro mesmo item — a checagem aqui só existe pra devolver um erro legível
 * em vez de deixar estourar a constraint).
 */
export async function createReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = reviewSchema.safeParse({
    orderItemId: formData.get("orderItemId"),
    rating: Number(formData.get("rating")),
    title: formData.get("title") || undefined,
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const orderItem = await prisma.orderItem.findFirst({
    where: { id: data.orderItemId, order: { userId: user.id, status: "DELIVERED" } },
    include: { review: true },
  });
  if (!orderItem) {
    return { status: "error", message: "Só é possível avaliar produtos de pedidos já entregues." };
  }
  if (orderItem.review) {
    return { status: "error", message: "Você já avaliou este produto." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          productId: orderItem.productId,
          userId: user.id,
          orderItemId: orderItem.id,
          rating: data.rating,
          title: data.title || null,
          comment: data.comment || null,
          isVerifiedPurchase: true,
        },
      });

      const aggregate = await tx.review.aggregate({
        where: { productId: orderItem.productId },
        _avg: { rating: true },
        _count: true,
      });

      await tx.product.update({
        where: { id: orderItem.productId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count,
        },
      });
    });
  } catch {
    // Constraint Review.productId_userId — já existe avaliação desse
    // usuário pro produto via outro pedido/item.
    return { status: "error", message: "Você já avaliou este produto." };
  }

  await logAudit({
    userId: user.id,
    action: "REVIEW_CREATED",
    entityType: "Review",
    entityId: orderItem.productId,
  });

  revalidatePath(`/minha-conta/pedidos`);
  return { status: "success", message: "Avaliação enviada. Obrigado!" };
}
