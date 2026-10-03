import { z } from "zod";

export const reviewSchema = z.object({
  orderItemId: z.string().uuid(),
  rating: z.number().int().min(1, "Escolha de 1 a 5 estrelas").max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().max(2000).optional(),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;
