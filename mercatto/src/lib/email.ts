import "server-only";
import nodemailer from "nodemailer";

const hasSmtpConfig = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

/** Em desenvolvimento, sem SMTP configurado, o e-mail não é enviado de
 * verdade: é só registrado no console (útil para testar os fluxos de
 * verificação / recuperação de senha sem precisar de uma conta SMTP). */
export async function sendEmail({ to, subject, html }: SendEmailInput) {
  if (!hasSmtpConfig) {
    console.log("─────────────────────────────────────────");
    console.log(`[email:dev] Para: ${to}`);
    console.log(`[email:dev] Assunto: ${subject}`);
    console.log(`[email:dev] Corpo:\n${html}`);
    console.log("─────────────────────────────────────────");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "Mercatto <no-reply@mercatto.local>",
    to,
    subject,
    html,
  });
}

export function verificationEmailHtml(verifyUrl: string) {
  return `<p>Bem-vindo(a) à Mercatto! Confirme seu e-mail para ativar sua conta:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>Este link expira em 24 horas.</p>`;
}

export function passwordResetEmailHtml(resetUrl: string) {
  return `<p>Recebemos um pedido para redefinir sua senha na Mercatto.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>Se você não pediu isso, pode ignorar este e-mail. O link expira em 1 hora.</p>`;
}
