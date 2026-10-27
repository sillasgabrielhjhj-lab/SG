/**
 * História da campanha. Escreva apenas fatos reais (um texto entre aspas por parágrafo).
 * Enquanto `paragraphs` estiver vazio, o site mostra o texto neutro de `placeholder`.
 */
export const story = {
  paragraphs: [
    "O pequeno Tobias tem apenas 9 meses e já enfrenta desafios sérios de saúde. Ele foi diagnosticado com duas hérnias, água nos rins e um sopro no coração.",
    "Desde os primeiros meses de vida, ele precisa de acompanhamento e tratamento médico.",
    "A família é de Parintins, no Amazonas, e precisou vir para Manaus em busca do tratamento do filho.",
    "Sem condições de pagar aluguel, a família contou com a ajuda de uma pessoa que cedeu um pequeno pedaço de terra para que pudessem morar.",
    "Foi ali que o pai do Tobias construiu, com as próprias mãos, um barraco improvisado. Hoje, a família vive no local sem energia elétrica e sem estrutura adequada.",
    "Esta campanha reúne pessoas dispostas a ajudar o Tobias. Qualquer valor faz a diferença, e compartilhar também ajuda.",
  ] as string[],
  /** Resumo em tópicos ("Em resumo"). Os mesmos fatos do texto, para leitura rápida. */
  facts: [
    { icon: "age", label: "Idade", text: "9 meses" },
    {
      icon: "health",
      label: "Diagnóstico",
      text: "Duas hérnias, água nos rins e um sopro no coração",
    },
    {
      icon: "family",
      label: "A família",
      text: "De Parintins (AM), em Manaus em busca do tratamento do filho",
    },
    {
      icon: "home",
      label: "Onde moram",
      text: "Em um barraco improvisado, construído pelo pai em um terreno cedido, sem energia elétrica e sem estrutura adequada",
    },
  ] as { icon: "age" | "health" | "family" | "home"; label: string; text: string }[],
  placeholder:
    "A história do Tobias e os motivos desta campanha serão contados aqui. Enquanto isso, você já pode ajudar com qualquer valor, ou compartilhar a campanha com quem puder se juntar a nós.",
  highlights: [
    "Cada gesto de solidariedade faz a diferença.",
    "Juntos podemos ajudar o Tobias.",
    "Se não puder doar, compartilhar também é uma forma de ajudar.",
  ],
};
