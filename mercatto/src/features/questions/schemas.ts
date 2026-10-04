import { z } from "zod";

export const askQuestionSchema = z.object({
  productId: z.string().min(1).max(64),
  body: z.string().trim().min(10, "Escreva pelo menos 10 caracteres").max(500, "Máximo de 500 caracteres"),
});

export const answerQuestionSchema = z.object({
  questionId: z.string().min(1).max(64),
  body: z.string().trim().min(2, "Escreva a resposta").max(1000, "Máximo de 1000 caracteres"),
});

export const moderateQuestionSchema = z.object({
  questionId: z.string().min(1).max(64),
  status: z.enum(["PUBLISHED", "REJECTED", "PENDING"]),
});
