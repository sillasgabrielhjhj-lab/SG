import "server-only";
import { db } from "@/server/db";
import { isDevelopment } from "@/server/env";
import { logger } from "@/server/observability/logger";
import type { EmailMessage, EmailProvider } from "@/server/providers/email/types";

/**
 * MODO DESENVOLVIMENTO: nenhum e-mail sai do servidor. Registra o envio
 * (EmailLog "logged") e, apenas em development, imprime o texto no terminal
 * para permitir testar links de verificação e redefinição de senha.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage) {
    logger.info("email.console", { to: message.to.replace(/(.{2}).*@/, "$1***@"), subject: message.subject, template: message.template });
    if (isDevelopment) console.info(`\n──── E-MAIL (dev) para ${message.to} ────\n${message.subject}\n\n${message.text}\n────────────────────────────\n`);
    await db.emailLog
      .create({ data: { to: message.to, subject: message.subject, template: message.template, provider: this.name, status: "logged" } })
      .catch(() => undefined);
    return { id: null };
  }
}
