export function buildShareMessage(url: string): string {
  return [
    "❤️ TODOS PELO TOBIAS ❤️",
    "Estamos unidos em uma campanha solidária para ajudar o Tobias. Qualquer contribuição faz a diferença!",
    "💚 Doe qualquer valor por Pix ou compartilhe esta campanha.",
    `🔗 ${url}`,
  ].join("\n");
}

export const whatsappShareUrl = (message: string) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;

export const facebookShareUrl = (url: string) =>
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
