"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requirePermission, requireUser } from "@/server/auth/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { createReviewSchema, moderateReviewSchema } from "@/features/reviews/schemas";
import { createReview, deleteOwnReview, moderateReview } from "@/features/reviews/service";

export const createReviewAction = createAction(
  createReviewSchema,
  async (input) => {
    const user = await requireUser();
    await enforceRateLimit(`review:${user.id}`, 20, 3600);
    const review = await createReview(user.id, input);
    revalidatePath("/minha-conta/avaliacoes");
    return ok(
      review,
      review.status === "PUBLISHED" ? "Obrigado! Sua avaliação foi publicada." : "Obrigado! Sua avaliação será publicada após revisão.",
    );
  },
  "reviews.create",
);

export const deleteReviewAction = createAction(
  z.object({ reviewId: z.string().min(1).max(64) }),
  async ({ reviewId }) => {
    const user = await requireUser();
    await deleteOwnReview(user.id, reviewId);
    revalidatePath("/minha-conta/avaliacoes");
    return ok(undefined, "Avaliação excluída.");
  },
  "reviews.delete",
);

export const moderateReviewAction = createAction(
  moderateReviewSchema,
  async (input) => {
    const user = await requirePermission("admin:moderation");
    await moderateReview(user.id, input);
    revalidatePath("/admin/moderacao");
    return ok(undefined, "Moderação registrada.");
  },
  "reviews.moderate",
);
