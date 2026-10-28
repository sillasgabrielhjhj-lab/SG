import "server-only";

/**
 * ✏️ TRANSPARÊNCIA — preencha somente com informações reais e verificáveis.
 * O que ficar vazio não aparece (o site mostra um aviso discreto de "em breve" no lugar).
 * Nada de depoimentos, números de doadores ou selos de verificação que não existam.
 */
export const transparency = {
  /** Quem organiza a arrecadação. Ex.: { name: "Ana Souza", role: "Mãe da May", about: "…" } */
  organizers: [] as { name: string; role?: string; about?: string }[],

  /** Dados que o doador pode conferir. Ex.: { label: "Início da campanha", value: "05/11/2026" } */
  facts: [] as { label: string; value: string }[],

  /** Contato oficial (ou variáveis CONTACT_EMAIL, CONTACT_WHATSAPP e CONTACT_INSTAGRAM na Vercel). */
  contact: {
    email: process.env.CONTACT_EMAIL || "",
    /** Só números, com DDI e DDD. Ex.: 5511999999999 */
    whatsapp: process.env.CONTACT_WHATSAPP || "",
    /** Ex.: @ajudemay */
    instagram: process.env.CONTACT_INSTAGRAM || "",
  },

  /** Atualizações publicadas pelos responsáveis, da mais recente para a mais antiga. */
  updates: [] as { date: string; title: string; text: string }[],
};
