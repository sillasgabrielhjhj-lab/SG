import { photos } from './images';

/**
 * TEXTOS DO SITE
 * ---------------------------------------------------------------
 * Textos de exemplo, escritos para servir de base. Revise para que
 * reflitam exatamente a história e o processo reais da pizzaria.
 */

export const navigation = [
  { label: 'Início', href: '#inicio' },
  { label: 'Cardápio', href: '#cardapio' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Avaliações', href: '#avaliacoes' },
  { label: 'Contato', href: '#contato' },
] as const;

export const hero = {
  eyebrow: 'Pizzaria artesanal · Delivery e retirada',
  titleStart: 'A pizza que vale',
  titleAccent: 'cada fatia.',
  description:
    'Massa de longa fermentação, molho de tomate da casa e ingredientes escolhidos a dedo. Monte seu pedido em poucos toques e receba quentinho em casa.',
  image: photos.hero,
  imageAlt: 'Pizza artesanal recém-saída do forno, vista de cima',
};

export const marqueeItems = [
  'Margherita',
  'Calabresa',
  'Quatro Queijos',
  'Parma & Rúcula',
  'Pepperoni',
  'Burrata',
  'Funghi Trufado',
  'Frango com Catupiry',
];

export const about = {
  eyebrow: 'Nossa história',
  titleStart: 'Feita à mão,',
  titleAccent: 'do jeito certo.',
  paragraphs: [
    'Tudo começou com uma ideia simples: fazer a pizza que a gente gostaria de comer em casa. Sem atalhos, sem pressa e com o mesmo cuidado de quem cozinha para a própria família.',
    'Hoje cada pizza ainda nasce assim — massa preparada todos os dias, molho feito na casa e ingredientes escolhidos com critério. O resultado chega à sua mesa: borda leve e aerada, recheio na medida e aquele sabor que faz pedir de novo.',
  ],
  images: [
    { src: photos.cozinha, alt: 'Preparo das pizzas na cozinha' },
    { src: photos.margherita, alt: 'Pizza margherita com manjericão fresco' },
  ],
  pillars: [
    {
      icon: 'wheat',
      title: 'Massa artesanal',
      text: 'Fermentação lenta para uma massa leve, aerada e fácil de digerir, com borda crocante por fora e macia por dentro.',
    },
    {
      icon: 'leaf',
      title: 'Ingredientes selecionados',
      text: 'Tomates maduros, queijos de qualidade, ervas frescas e embutidos escolhidos para cada receita.',
    },
    {
      icon: 'flame',
      title: 'Forno bem quente',
      text: 'Assamos em alta temperatura por poucos minutos — o segredo da borda dourada e do recheio suculento.',
    },
  ],
} as const;

export const process = {
  eyebrow: 'Processo de produção',
  title: 'Do preparo da massa à sua porta',
  steps: [
    {
      icon: 'wheat',
      title: 'A massa',
      text: 'Farinha selecionada, água, sal e fermento. Sovada todos os dias, em pequenos lotes.',
    },
    {
      icon: 'timer',
      title: 'O descanso',
      text: 'A massa descansa por horas para desenvolver sabor, leveza e textura.',
    },
    {
      icon: 'chef',
      title: 'A montagem',
      text: 'Aberta à mão e montada na hora do pedido, com recheio distribuído até a borda.',
    },
    {
      icon: 'flame',
      title: 'O forno',
      text: 'Assada em alta temperatura e embalada para chegar quente e crocante.',
    },
  ],
} as const;

export const finalCta = {
  title: 'Bateu a fome?',
  text: 'Seu pedido sai em poucos toques. Escolha, personalize e finalize pelo WhatsApp.',
  image: photos.pepperoni,
  imageAlt: 'Pizza de pepperoni saindo do forno',
};
