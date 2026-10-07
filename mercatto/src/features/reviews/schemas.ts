import { z } from "zod";
import { optionalText } from "@/lib/validators/common";

/** URLs de fotos aceitas: somente arquivos enviados pelo upload da plataforma. */
export const reviewPhotoUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (u) => u.startsWith("/uploads/reviews/") || /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/reviews\//i.test(u),
    "Foto inválida",
  );

/** Vídeo da avaliação: somente arquivos enviados pelo upload de vídeos da plataforma. */
export const reviewVideoUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (u) => u.startsWith("/uploads/reviews/videos/") || /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/reviews\/videos\//i.test(u),
    "Vídeo inválido",
  );

export const createReviewSchema = z.object({
  orderItemId: z.string().min(1).max(64),
  rating: z.coerce.number().int().min(1, "Escolha de 1 a 5 estrelas").max(5),
  title: optionalText(100),
  comment: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().min(10, "Escreva pelo menos 10 caracteres").max(2000).optional(),
  ),
  photos: z.array(reviewPhotoUrl).max(5, "Envie no máximo 5 fotos").default([]),
  videos: z.array(reviewVideoUrl).max(1, "Envie no máximo 1 vídeo").default([]),
});

export const moderateReviewSchema = z.object({
  reviewId: z.string().min(1).max(64),
  status: z.enum(["PUBLISHED", "REJECTED", "PENDING"]),
  note: optionalText(300),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
