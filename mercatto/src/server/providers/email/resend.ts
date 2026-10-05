import "server-only";
import { db } from "@/server/db";
import { providerRequest } from "@/server/providers/http";
import { ProviderConfigurationError } from "@/server/providers/errors";
import type { EmailMessage, EmailProvider } from "@/server/providers/email/types";

/** Resend (https://resend.com) — envio real. Requer RESEND_API_KEY e domínio verificado em EMAIL_FROM. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(private readonly apiKey: string, private readonly from: string) {
    if (!apiKey) throw new ProviderConfigurationError("resend", "EMAIL_PROVIDER=resend requer RESEND_API_KEY.");
  }

  async send(message: EmailMessage) {
    try {
      const { data } = await providerRequest<{ id?: string }>({
        provider: this.name,
        url: "https://api.resend.com/emails",
        method: "POST",
        timeoutMs: 8000,
        userMessage: "Não foi possível enviar o e-mail agora.",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        json: { from: this.from, to: [message.to], subject: message.subject, html: message.html, text: message.text, tags: [{ name: "template", value: message.template }] },
      });
      await db.emailLog.create({ data: { to: message.to, subject: message.subject, template: message.template, provider: this.name, status: "sent" } }).catch(() => undefined);
      return { id: data?.id ?? null };
    } catch (error) {
      await db.emailLog
        .create({ data: { to: message.to, subject: message.subject, template: message.template, provider: this.name, status: "failed", error: error instanceof Error ? error.message.slice(0, 300) : "erro" } })
        .catch(() => undefined);
      throw error;
    }
  }
}
