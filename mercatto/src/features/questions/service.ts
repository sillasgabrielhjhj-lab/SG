import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { AppError, conflict, forbidden, notFound } from "@/server/errors";
import { audit } from "@/server/observability/audit";
import { sanitizePlainText, screenText } from "@/features/moderation/filter";

type Notify = (input: { userId: string; type: "NEW_QUESTION" | "QUESTION_ANSWERED"; title: string; body: string; link?: string }) => Promise<unknown>;

/** Carrega o serviço de notificações sob demanda (evita acoplamento rígido entre módulos). */
async function getNotify(): Promise<Notify> {
  const mod = (await import("@/features/notifications/service")) as { notify: Notify };
  return mod.notify;
}

export async function askQuestion(userId: string, input: { productId: string; body: string }) {
  const product = await db.product.findFirst({
    where: { id: input.productId, status: { in: ["ACTIVE", "OUT_OF_STOCK"] }, store: { status: "ACTIVE" } },
    select: { id: true, name: true, slug: true, store: { select: { ownerId: true } } },
  });
  if (!product) throw notFound("Produto não encontrado.");
  if (product.store.ownerId === userId) throw new AppError("UNPROCESSABLE", "Você não pode perguntar no seu próprio anúncio.");

  const body = sanitizePlainText(input.body);
  const screening = screenText(body);
  const question = await db.question.create({
    data: { productId: product.id, userId, body, status: screening.flagged ? "PENDING" : "PUBLISHED" },
    select: { id: true, status: true, createdAt: true },
  });

  if (question.status === "PUBLISHED") {
    const notify = await getNotify();
    await notify({
      userId: product.store.ownerId,
      type: "NEW_QUESTION",
      title: "Nova pergunta no seu anúncio",
      body: `${product.name}: "${body.slice(0, 120)}"`,
      link: "/vendedor/perguntas",
    }).catch(() => undefined);
  }
  return { ...question, flagged: screening.flagged };
}

export async function answerQuestion(
  actor: { userId: string; role: Role; storeId: string | null },
  input: { questionId: string; body: string },
) {
  const question = await db.question.findUnique({
    where: { id: input.questionId },
    select: {
      id: true,
      userId: true,
      status: true,
      answer: { select: { id: true } },
      product: { select: { storeId: true, name: true, slug: true } },
    },
  });
  if (!question) throw notFound("Pergunta não encontrada.");
  const isOwner = actor.storeId !== null && question.product.storeId === actor.storeId;
  if (!isOwner && actor.role !== "ADMIN") throw forbidden("Apenas a loja do anúncio pode responder.");
  if (question.answer) throw conflict("Esta pergunta já foi respondida.");
  if (question.status === "REJECTED") throw new AppError("UNPROCESSABLE", "Pergunta removida pela moderação.");

  const body = sanitizePlainText(input.body);
  const screening = screenText(body);
  if (screening.reasons.includes("linguagem_ofensiva")) {
    throw new AppError("UNPROCESSABLE", "Revise a resposta: linguagem não permitida.");
  }
  if (screening.flagged) {
    throw new AppError("UNPROCESSABLE", "Não compartilhe links, e-mails ou telefones nas respostas. A negociação deve acontecer na Mercatto.");
  }

  const answer = await db.answer.create({
    data: { questionId: question.id, storeId: question.product.storeId, userId: actor.userId, body },
    select: { id: true, createdAt: true },
  });

  const notify = await getNotify();
  await notify({
    userId: question.userId,
    type: "QUESTION_ANSWERED",
    title: "Sua pergunta foi respondida",
    body: `${question.product.name}: "${body.slice(0, 120)}"`,
    link: `/produto/${question.product.slug}#perguntas`,
  }).catch(() => undefined);
  return answer;
}

export async function moderateQuestion(actorId: string, input: { questionId: string; status: "PUBLISHED" | "REJECTED" | "PENDING" }) {
  const question = await db.question.findUnique({ where: { id: input.questionId }, select: { id: true, status: true } });
  if (!question) throw notFound("Pergunta não encontrada.");
  await db.question.update({ where: { id: question.id }, data: { status: input.status } });
  await audit({
    actorId,
    action: "question.moderated",
    entityType: "Question",
    entityId: question.id,
    before: { status: question.status },
    after: { status: input.status },
  });
}

export async function deleteOwnQuestion(userId: string, questionId: string) {
  const question = await db.question.findUnique({ where: { id: questionId }, select: { userId: true, answer: { select: { id: true } } } });
  if (!question) throw notFound("Pergunta não encontrada.");
  if (question.userId !== userId) throw forbidden();
  if (question.answer) throw new AppError("UNPROCESSABLE", "Perguntas já respondidas não podem ser excluídas.");
  await db.question.delete({ where: { id: questionId } });
}
