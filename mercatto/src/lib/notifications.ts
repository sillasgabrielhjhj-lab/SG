import "server-only";

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/enums";

/**
 * Cria uma notificação in-app. Nunca lança erro pro chamador — notificar
 * é um efeito colateral best-effort, uma falha aqui não pode derrubar o
 * fluxo principal (ex: aprovar um pagamento) que a disparou.
 */
export async function notifyUser(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
}) {
  await prisma.notification
    .create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        linkUrl: input.linkUrl,
      },
    })
    .catch((error) => {
      console.error("Falha ao criar notificação", error);
    });
}
