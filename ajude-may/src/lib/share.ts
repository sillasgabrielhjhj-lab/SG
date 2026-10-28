export const SHARE_TITLE = "Ajude May nessa caminhada ❤️";

const SHARE_LINES = [
  "💗 AJUDE MAY NESSA CAMINHADA",
  "May enfrenta diariamente os desafios de conviver com uma condição rara e precisa de cuidados e acompanhamento contínuos.",
  "Sua solidariedade pode ajudar a proporcionar mais conforto, segurança e qualidade de vida.",
  "🙏 Qualquer valor faz a diferença.",
  "❤️ Doe ou compartilhe essa campanha.",
];

/** Texto pronto para WhatsApp e afins, com o link da campanha na última linha. */
export function buildShareMessage(url: string): string {
  return [...SHARE_LINES, `🔗 ${url}`].join("\n");
}

/** Para o compartilhamento nativo: o link vai separado (o sistema o acrescenta ao texto). */
export const nativeShareText = () => SHARE_LINES.join("\n");

export const whatsappShareUrl = (message: string) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;

export const facebookShareUrl = (url: string) =>
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
