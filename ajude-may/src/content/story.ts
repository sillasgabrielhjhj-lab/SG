/**
 * História da campanha, a partir da descrição oficial. Escreva apenas fatos reais: sem diagnóstico,
 * tratamento ou prognóstico que não tenham sido informados pela família.
 */
export const story = {
  paragraphs: [
    "💔 May convive com uma condição rara que mudou completamente a sua rotina e trouxe desafios que vão muito além do que aparece por fora.",
    "Ela precisa de cuidados constantes, acompanhamento e apoio para continuar enfrentando essa realidade.",
    "🙏 Qualquer contribuição pode ajudar a trazer mais conforto, segurança e qualidade de vida para os dias dela. ❤️",
  ],
  /** Resumo em tópicos: os mesmos fatos do texto, para leitura rápida. */
  facts: [
    {
      icon: "rare",
      label: "A realidade",
      text: "Uma condição rara, que mudou completamente a rotina da May",
    },
    {
      icon: "care",
      label: "Do que ela precisa",
      text: "Cuidados constantes, acompanhamento e apoio",
    },
    {
      icon: "goal",
      label: "O objetivo da campanha",
      text: "Trazer mais conforto, segurança e qualidade de vida para os dias dela",
    },
  ] as { icon: "rare" | "care" | "goal"; label: string; text: string }[],
};

/** Seção emocional "Uma caminhada que merece apoio, carinho e esperança." */
export const journey = {
  title: "Uma caminhada que merece apoio, carinho e esperança.",
  paragraphs: [
    "A rotina da May é marcada por desafios que nem sempre conseguimos perceber. Conviver com uma condição rara exige cuidados, acompanhamento e apoio contínuo.",
    "Em meio a essa realidade, cada demonstração de solidariedade tem valor.",
    "Sua contribuição pode ajudar a proporcionar mais conforto, segurança e qualidade de vida para a May.",
    "Não importa se você pode contribuir com pouco ou muito. Cada gesto de carinho faz parte dessa caminhada.",
  ],
  closing:
    "E, se não puder doar neste momento, compartilhar essa história também é uma maneira importante de ajudar. ❤️",
};
