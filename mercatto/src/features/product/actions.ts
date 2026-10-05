"use server";

import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { getProductQuestions, getProductReviews } from "@/features/product/queries";

/** Leitura pública paginada de avaliações (somente PUBLISHED). */
export const loadReviewsAction = createAction(
  z.object({ productId: z.string().min(1).max(64), page: z.coerce.number().int().min(1).max(500).default(1), rating: z.coerce.number().int().min(1).max(5).optional(), withPhotos: z.boolean().optional() }),
  async (input) => ok(await getProductReviews(input.productId, input)),
  "product.load_reviews",
);

export const loadQuestionsAction = createAction(
  z.object({ productId: z.string().min(1).max(64), page: z.coerce.number().int().min(1).max(500).default(1) }),
  async (input) => ok(await getProductQuestions(input.productId, input)),
  "product.load_questions",
);
