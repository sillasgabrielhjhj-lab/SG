import { resolvePixSetup } from "@/lib/pix/setup";

/**
 * Configurações da campanha. Tudo que você precisa preencher antes de publicar está aqui.
 *
 * Os campos marcados com ✏️ podem ser escritos direto neste arquivo (entre as aspas) ou definidos
 * por variável de ambiente (veja .env.example); a variável, quando existe, tem prioridade.
 */
export const campaign = {
  name: "Todos pelo Tobias",
  person: "Tobias",
  tagline: "Sua solidariedade pode fazer a diferença na vida do Tobias.",
  description:
    "Uma campanha solidária para ajudar o Tobias. Qualquer valor faz a diferença, e a doação é feita por Pix, direto no aplicativo do seu banco.",

  pix: {
    /** Chave Pix oficial da campanha (e-mail). */
    key: "tobiasvaquinha87@gmail.com",
    /** ✏️ Nome do recebedor, exatamente como no cadastro da chave Pix (máx. 25 letras, sem acento). */
    receiverName: process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME || "",
    /** ✏️ Cidade do recebedor (máx. 15 letras, sem acento). */
    receiverCity: process.env.NEXT_PUBLIC_PIX_RECEIVER_CITY || "",
    /** Mensagem que aparece para quem paga e no extrato de quem recebe. */
    description: "Todos pelo Tobias",
  },

  donation: {
    /** Valores sugeridos, em centavos: 500 = R$ 5,00. */
    presetsCents: [500, 1000, 2000, 5000, 10000],
    minCents: 1,
    maxCents: 9_999_999,
  },

  /** ✏️ Canais de contato (deixe "" para não exibir). WhatsApp: só números com DDI, ex.: 5511999999999. */
  contact: {
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
    whatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "",
    instagram: process.env.NEXT_PUBLIC_CONTACT_INSTAGRAM || "",
  },
};

/** Estado do Pix: pronto para gerar QR Code ou pendente de nome/cidade do recebedor. */
export const pixSetup = resolvePixSetup(campaign.pix, process.env.NODE_ENV);
