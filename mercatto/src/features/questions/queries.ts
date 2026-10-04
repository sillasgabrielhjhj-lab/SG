import "server-only";
import { db } from "@/server/db";
import type { QuestionStatus } from "@/generated/prisma/enums";

const PAGE = 20;

const QUESTION_SELECT = {
  id: true,
  body: true,
  status: true,
  isDemo: true,
  createdAt: true,
  user: { select: { name: true } },
  product: { select: { id: true, name: true, slug: true, images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } } } },
  answer: { select: { body: true, createdAt: true } },
} as const;

export async function listUserQuestions(userId: string, page = 1) {
  const where = { userId };
  const [items, total] = await Promise.all([
    db.question.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: QUESTION_SELECT }),
    db.question.count({ where }),
  ]);
  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

/** Perguntas dos anúncios de uma loja (escopo por storeId => sem IDOR). */
export async function listStoreQuestions(
  storeId: string,
  filters: { status?: "unanswered" | "answered" | "all"; page?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const status = filters.status ?? "unanswered";
  const where = {
    product: { storeId },
    status: { not: "REJECTED" as const },
    ...(status === "unanswered" ? { answer: { is: null } } : status === "answered" ? { answer: { isNot: null } } : {}),
  };
  const [items, total, unanswered] = await Promise.all([
    db.question.findMany({ where, orderBy: { createdAt: status === "unanswered" ? "asc" : "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: QUESTION_SELECT }),
    db.question.count({ where }),
    db.question.count({ where: { product: { storeId }, status: { not: "REJECTED" }, answer: { is: null } } }),
  ]);
  return { items, total, unanswered, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function listQuestionsForModeration(filters: { status?: QuestionStatus; page?: number } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where = filters.status ? { status: filters.status } : {};
  const [items, total] = await Promise.all([
    db.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { ...QUESTION_SELECT, user: { select: { name: true, email: true } }, product: { select: { id: true, name: true, slug: true, store: { select: { name: true } }, images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } } } } },
    }),
    db.question.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}
