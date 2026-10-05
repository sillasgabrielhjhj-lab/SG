/**
 * URL pública da aplicação (sem barra final). Ordem: APP_URL explícita →
 * domínio de produção da Vercel → URL do deployment (previews) → localhost.
 * Sem "server-only": usado também por metadata e templates de e-mail.
 */
export function resolveAppUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelProd = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;
  const vercelHost = vercelProd || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}
