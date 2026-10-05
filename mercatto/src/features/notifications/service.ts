import "server-only";
import { db, type Tx } from "@/server/db";
import { logger } from "@/server/observability/logger";
import { getEmailProvider } from "@/server/providers/email";
import type { NotificationType } from "@/generated/prisma/enums";
import type { EmailContent } from "@/features/notifications/templates";

/**
 * Central de notificações. Canais:
 *  - in-app (Notification) — sempre, dentro da transação quando informada;
 *  - e-mail — opcional, enviado FORA da transação e sem derrubar a operação;
 *  - push — arquitetura preparada (implemente um NotificationChannel quando houver provedor).
 */
export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  email?: EmailContent;
};

export interface NotificationChannel {
  readonly name: string;
  deliver(input: NotifyInput & { email: string }): Promise<void>;
}

async function sendEmail(userId: string, content: EmailContent) {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
    if (!user || user.status !== "ACTIVE") return;
    await getEmailProvider().send({ to: user.email, ...content });
  } catch (error) {
    logger.error("notifications.email_failed", { template: content.template, error });
  }
}

export async function notify(input: NotifyInput, tx?: Tx) {
  const notification = await (tx ?? db).notification.create({
    data: { userId: input.userId, type: input.type, title: input.title.slice(0, 160), body: input.body.slice(0, 500), link: input.link ?? null },
    select: { id: true },
  });
  if (input.email) {
    const content = input.email;
    if (!tx) {
      await sendEmail(input.userId, content);
    } else {
      // Dentro de transação: agenda o envio para depois da resposta (after) —
      // e-mail não deve bloquear nem desfazer a operação principal.
      try {
        const { after } = await import("next/server");
        after(() => sendEmail(input.userId, content));
      } catch {
        void sendEmail(input.userId, content);
      }
    }
  }
  return notification;
}
