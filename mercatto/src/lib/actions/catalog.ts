"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/actions/auth";

const askQuestionSchema = z.object({
  productId: z.string().uuid(),
  productSlug: z.string(),
  question: z.string().trim().min(5, "Escreva uma pergunta um pouco mais detalhada").max(500),
});

export async function askQuestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = askQuestionSchema.safeParse({
    productId: formData.get("productId"),
    productSlug: formData.get("productSlug"),
    question: formData.get("question"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { allowed } = await rateLimit(`ask-question:${user.id}`, 10, 60 * 60);
  if (!allowed) {
    return { status: "error", message: "Muitas perguntas enviadas. Tente novamente mais tarde." };
  }

  await prisma.question.create({
    data: {
      productId: parsed.data.productId,
      userId: user.id,
      question: parsed.data.question,
    },
  });

  revalidatePath(`/produto/${parsed.data.productSlug}`);
  return { status: "success", message: "Pergunta enviada! O vendedor vai responder em breve." };
}
