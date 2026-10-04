"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requirePermission, requireUser } from "@/server/auth/guards";
import { forbidden } from "@/server/errors";
import { hasPermission } from "@/server/auth/rbac";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { answerQuestionSchema, askQuestionSchema, moderateQuestionSchema } from "@/features/questions/schemas";
import { answerQuestion, askQuestion, deleteOwnQuestion, moderateQuestion } from "@/features/questions/service";

export const askQuestionAction = createAction(
  askQuestionSchema,
  async (input) => {
    const user = await requireUser();
    await enforceRateLimit(`question:${user.id}`, 10, 3600);
    const question = await askQuestion(user.id, input);
    return ok(
      { id: question.id, status: question.status },
      question.flagged
        ? "Pergunta enviada para revisão: evite links, e-mails ou telefones."
        : "Pergunta enviada! Avisaremos quando a loja responder.",
    );
  },
  "questions.ask",
);

export const answerQuestionAction = createAction(
  answerQuestionSchema,
  async (input) => {
    const user = await requireUser();
    if (!hasPermission(user.role, "seller:access") && user.role !== "ADMIN") throw forbidden();
    await enforceRateLimit(`answer:${user.id}`, 120, 3600);
    const answer = await answerQuestion({ userId: user.id, role: user.role, storeId: user.storeId }, input);
    revalidatePath("/vendedor/perguntas");
    return ok(answer, "Resposta publicada.");
  },
  "questions.answer",
);

export const moderateQuestionAction = createAction(
  moderateQuestionSchema,
  async (input) => {
    const user = await requirePermission("admin:moderation");
    await moderateQuestion(user.id, input);
    revalidatePath("/admin/perguntas");
    return ok(undefined, "Moderação registrada.");
  },
  "questions.moderate",
);

export const deleteQuestionAction = createAction(
  z.object({ questionId: z.string().min(1).max(64) }),
  async ({ questionId }) => {
    const user = await requireUser();
    await deleteOwnQuestion(user.id, questionId);
    revalidatePath("/minha-conta/perguntas");
    return ok(undefined, "Pergunta excluída.");
  },
  "questions.delete",
);
