/**
 * Triagem automática de textos públicos (perguntas, respostas, avaliações).
 * Não bloqueia sozinha: textos sinalizados vão para moderação (PENDING).
 * Também evita negociação fora da plataforma (contatos/links) — prática
 * comum em marketplaces para proteger o comprador.
 */
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|br|io|me|app|shop|store)\b/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s.]?\d{4}\b/;
const OFF_PLATFORM_RE = /\b(whats\s?app|zap|wpp|telegram|instagram|me chama no|meu n[uú]mero|pix direto)\b/i;
// Lista curta e conservadora; amplie conforme a política de moderação.
const ABUSIVE = ["idiota", "imbecil", "otario", "otário", "vagabundo", "lixo de loja", "golpista"];

export type ScreenResult = { flagged: boolean; reasons: string[] };

export function screenText(text: string): ScreenResult {
  const reasons: string[] = [];
  const lower = text.toLowerCase();
  if (URL_RE.test(text)) reasons.push("link");
  if (EMAIL_RE.test(text)) reasons.push("email");
  if (PHONE_RE.test(text)) reasons.push("telefone");
  if (OFF_PLATFORM_RE.test(text)) reasons.push("contato_fora_da_plataforma");
  if (ABUSIVE.some((w) => lower.includes(w))) reasons.push("linguagem_ofensiva");
  return { flagged: reasons.length > 0, reasons };
}

/** Normaliza espaços e remove caracteres de controle. */
export function sanitizePlainText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
