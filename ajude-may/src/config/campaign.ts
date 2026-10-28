/**
 * Textos e opções gerais da campanha (sem dados sensíveis; pode ser usado em qualquer componente).
 * Chave Pix: src/config/pix.ts · Meta: src/config/fundraising.ts · Fotos: src/content/photos.ts
 */
export const campaign = {
  name: "Ajude May nessa caminhada",
  shortName: "Ajude May",
  person: "May",
  title: "Ajude May nessa caminhada ❤️",
  subtitle:
    "Algumas batalhas não são visíveis aos olhos, mas fazem parte de cada dia. Com a sua solidariedade, podemos ajudar a tornar a caminhada da May mais acolhedora, segura e cheia de esperança.",
  highlight:
    "Por trás de cada desafio existe uma pessoa que merece cuidado, carinho e apoio. Sua contribuição, independentemente do valor, pode fazer a diferença na vida da May.",
  description:
    "May convive com uma condição rara e precisa de cuidados constantes, acompanhamento e apoio. Qualquer contribuição pode trazer mais conforto, segurança e qualidade de vida para os dias dela.",

  donation: {
    /** Valores sugeridos, em centavos: 500 = R$ 5,00. */
    presetsCents: [500, 1000, 2000, 5000, 10000],
    minCents: 1,
    maxCents: 9_999_999,
  },
};
