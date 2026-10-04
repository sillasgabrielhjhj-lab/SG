export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Identificador do template (para log/auditoria). */
  template: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string | null }>;
}
