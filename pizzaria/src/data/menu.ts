import type { Product } from '@/types/menu';
import { photos } from './images';
import { pizzaPrices } from './options';

/**
 * CARDÁPIO
 * ---------------------------------------------------------------
 * Nomes, ingredientes e preços abaixo são EXEMPLOS: edite à vontade.
 *
 * Como adicionar um produto: copie um item parecido, troque o `id`
 * (único, sem espaços) e ajuste os campos. Os tipos em src/types/menu.ts
 * explicam cada campo.
 *
 * - featured: true      → aparece em "Os mais pedidos"
 * - available: false    → aparece como "Esgotado"
 * - halfAndHalf         → permite pedir meio a meio
 * - optionGroups        → bordas, adicionais, sabores (src/data/options.ts)
 */

const salgada = ['borda-salgada', 'adicionais-salgados'];
const doce = ['borda-doce', 'adicionais-doces'];

export const products: Product[] = [
  // ------------------------------------------------------------ Pizzas
  {
    id: 'margherita',
    name: 'Margherita',
    description: 'Molho de tomate italiano, mussarela, tomate fresco, manjericão e azeite extravirgem.',
    category: 'pizzas',
    image: photos.margherita,
    sizes: pizzaPrices({ broto: 39.9, media: 54.9, grande: 69.9 }),
    optionGroups: salgada,
    tags: ['mais-pedido', 'vegetariano'],
    featured: true,
    halfAndHalf: 'salgada',
  },
  {
    id: 'calabresa',
    name: 'Calabresa',
    description: 'Molho de tomate, mussarela, calabresa fatiada, cebola roxa, azeitonas e orégano.',
    category: 'pizzas',
    image: photos.calabresa,
    sizes: pizzaPrices({ broto: 39.9, media: 54.9, grande: 69.9 }),
    optionGroups: salgada,
    tags: ['mais-pedido'],
    featured: true,
    halfAndHalf: 'salgada',
  },
  {
    id: 'quatro-queijos',
    name: 'Quatro Queijos',
    description: 'Mussarela, gorgonzola, parmesão e catupiry, finalizada com orégano.',
    category: 'pizzas',
    image: photos.quatroQueijos,
    sizes: pizzaPrices({ broto: 44.9, media: 62.9, grande: 78.9 }),
    optionGroups: salgada,
    tags: ['vegetariano'],
    featured: true,
    halfAndHalf: 'salgada',
  },
  {
    id: 'frango-catupiry',
    name: 'Frango com Catupiry',
    description: 'Frango desfiado e temperado na casa, catupiry, mussarela e orégano.',
    category: 'pizzas',
    image: photos.frangoCatupiry,
    sizes: pizzaPrices({ broto: 42.9, media: 59.9, grande: 74.9 }),
    optionGroups: salgada,
    tags: ['mais-pedido'],
    featured: true,
    halfAndHalf: 'salgada',
  },
  {
    id: 'pepperoni',
    name: 'Pepperoni',
    description: 'Molho de tomate, mussarela e generosas fatias de pepperoni levemente picante.',
    category: 'pizzas',
    image: photos.pepperoni,
    sizes: pizzaPrices({ broto: 44.9, media: 62.9, grande: 78.9 }),
    optionGroups: salgada,
    tags: ['picante'],
    featured: true,
    halfAndHalf: 'salgada',
  },
  {
    id: 'portuguesa',
    name: 'Portuguesa',
    description: 'Mussarela, presunto, ovos, cebola, ervilha, azeitonas e orégano.',
    category: 'pizzas',
    image: photos.portuguesa,
    sizes: pizzaPrices({ broto: 42.9, media: 59.9, grande: 74.9 }),
    optionGroups: salgada,
    halfAndHalf: 'salgada',
  },
  {
    id: 'napolitana',
    name: 'Napolitana',
    description: 'Mussarela, rodelas de tomate, parmesão ralado, manjericão e alho dourado.',
    category: 'pizzas',
    image: photos.napolitana,
    sizes: pizzaPrices({ broto: 39.9, media: 54.9, grande: 69.9 }),
    optionGroups: salgada,
    tags: ['vegetariano'],
    halfAndHalf: 'salgada',
  },
  {
    id: 'bacon-cheddar',
    name: 'Bacon & Cheddar',
    description: 'Mussarela, cheddar cremoso, bacon crocante e cebolinha.',
    category: 'pizzas',
    image: photos.baconCheddar,
    sizes: pizzaPrices({ broto: 42.9, media: 59.9, grande: 74.9 }),
    optionGroups: salgada,
    halfAndHalf: 'salgada',
  },
  {
    id: 'mussarela',
    name: 'Mussarela',
    description: 'Molho de tomate, mussarela, rodelas de tomate e orégano.',
    category: 'pizzas',
    image: photos.mussarela,
    sizes: pizzaPrices({ broto: 36.9, media: 49.9, grande: 64.9 }),
    optionGroups: salgada,
    tags: ['vegetariano'],
    halfAndHalf: 'salgada',
  },

  // ------------------------------------------------------------ Especiais
  {
    id: 'parma-rucula',
    name: 'Parma & Rúcula',
    description: 'Mussarela, presunto parma, rúcula fresca, tomate-cereja e lascas de parmesão.',
    category: 'especiais',
    image: photos.parmaRucula,
    sizes: pizzaPrices({ broto: 54.9, media: 76.9, grande: 94.9 }),
    optionGroups: salgada,
    tags: ['chef'],
    featured: true,
    halfAndHalf: 'salgada',
  },
  {
    id: 'burrata',
    name: 'Burrata',
    description: 'Molho de tomate pelado, burrata cremosa, pesto de manjericão e tomate-cereja confitado.',
    category: 'especiais',
    image: photos.burrata,
    sizes: pizzaPrices({ broto: 59.9, media: 82.9, grande: 99.9 }),
    optionGroups: salgada,
    tags: ['novidade', 'vegetariano'],
    halfAndHalf: 'salgada',
  },
  {
    id: 'diavola',
    name: 'Diavola',
    description: 'Molho de tomate, mussarela, salame picante, pimenta calabresa e fio de mel apimentado.',
    category: 'especiais',
    image: photos.diavola,
    sizes: pizzaPrices({ broto: 52.9, media: 72.9, grande: 89.9 }),
    optionGroups: salgada,
    tags: ['picante'],
    halfAndHalf: 'salgada',
  },
  {
    id: 'funghi-trufado',
    name: 'Funghi Trufado',
    description: 'Mussarela, mix de cogumelos salteados na manteiga, azeite trufado e parmesão.',
    category: 'especiais',
    image: photos.funghi,
    sizes: pizzaPrices({ broto: 56.9, media: 78.9, grande: 96.9 }),
    optionGroups: salgada,
    tags: ['chef', 'vegetariano'],
    halfAndHalf: 'salgada',
  },
  {
    id: 'carne-seca',
    name: 'Carne Seca & Catupiry',
    description: 'Carne seca desfiada, catupiry, cebola roxa e cheiro-verde.',
    category: 'especiais',
    image: photos.carneSeca,
    sizes: pizzaPrices({ broto: 54.9, media: 74.9, grande: 92.9 }),
    optionGroups: salgada,
    halfAndHalf: 'salgada',
  },

  // ------------------------------------------------------------ Pizzas doces
  {
    id: 'chocolate-morango',
    name: 'Chocolate com Morango',
    description: 'Chocolate ao leite cremoso, morangos frescos e raspas de chocolate.',
    category: 'doces',
    sizes: pizzaPrices({ broto: 39.9, media: 54.9 }),
    optionGroups: doce,
    tags: ['mais-pedido'],
    halfAndHalf: 'doce',
  },
  {
    id: 'banana-canela',
    name: 'Banana com Canela',
    description: 'Banana fatiada, açúcar, canela e um fio de leite condensado.',
    category: 'doces',
    sizes: pizzaPrices({ broto: 36.9, media: 49.9 }),
    optionGroups: doce,
    halfAndHalf: 'doce',
  },
  {
    id: 'romeu-julieta',
    name: 'Romeu e Julieta',
    description: 'Goiabada cremosa derretida sobre queijo.',
    category: 'doces',
    sizes: pizzaPrices({ broto: 36.9, media: 49.9 }),
    optionGroups: doce,
    halfAndHalf: 'doce',
  },
  {
    id: 'chocolate-coco',
    name: 'Chocolate com Coco',
    description: 'Chocolate, coco ralado e leite condensado.',
    category: 'doces',
    sizes: pizzaPrices({ broto: 38.9, media: 52.9 }),
    optionGroups: doce,
    halfAndHalf: 'doce',
  },

  // ------------------------------------------------------------ Combos
  {
    id: 'combo-casal',
    name: 'Combo Casal',
    description: '1 pizza grande tradicional + 2 refrigerantes lata.',
    category: 'combos',
    image: photos.comboCasal,
    price: 79.9,
    optionGroups: ['combo-pizza-1', 'combo-refri-lata-1', 'combo-refri-lata-2'],
    serves: 'Serve 2 pessoas',
  },
  {
    id: 'combo-familia',
    name: 'Combo Família',
    description: '2 pizzas grandes tradicionais + 1 refrigerante 2 L.',
    category: 'combos',
    image: photos.frangoCatupiry,
    price: 139.9,
    optionGroups: ['combo-pizza-1', 'combo-pizza-2', 'combo-refri-2l'],
    tags: ['mais-pedido'],
    serves: 'Serve 4 a 5 pessoas',
  },
  {
    id: 'combo-salgada-doce',
    name: 'Combo Salgada + Doce',
    description: '1 pizza grande tradicional + 1 pizza doce broto + 1 refrigerante 2 L.',
    category: 'combos',
    image: photos.portuguesa,
    price: 114.9,
    optionGroups: ['combo-pizza-1', 'combo-pizza-doce', 'combo-refri-2l'],
    serves: 'Serve 3 a 4 pessoas',
  },

  // ------------------------------------------------------------ Bebidas
  {
    id: 'refrigerante',
    name: 'Refrigerante',
    description: 'Lata 350 ml ou garrafa 2 L. Escolha o sabor.',
    category: 'bebidas',
    sizes: [
      { id: 'lata', name: 'Lata', detail: '350 ml', price: 6.9 },
      { id: '2l', name: 'Garrafa', detail: '2 L', price: 15.9 },
    ],
    optionGroups: ['sabor-refrigerante'],
  },
  {
    id: 'suco-natural',
    name: 'Suco natural',
    description: 'Feito na hora com fruta de verdade. 500 ml.',
    category: 'bebidas',
    price: 12.9,
    optionGroups: ['sabor-suco'],
  },
  {
    id: 'agua',
    name: 'Água mineral',
    description: 'Garrafa 500 ml, com ou sem gás.',
    category: 'bebidas',
    price: 4.9,
    optionGroups: ['tipo-agua'],
  },

  // ------------------------------------------------------------ Sobremesas
  {
    id: 'tiramisu',
    name: 'Tiramisù',
    description: 'Biscoito embebido em café, creme de mascarpone e cacau em pó.',
    category: 'sobremesas',
    image: photos.tiramisu,
    price: 22.9,
    tags: ['chef'],
  },
  {
    id: 'petit-gateau',
    name: 'Petit gâteau',
    description: 'Bolinho de chocolate com interior cremoso e sorvete de creme.',
    category: 'sobremesas',
    image: photos.chocolate,
    price: 24.9,
  },
  {
    id: 'panna-cotta',
    name: 'Panna cotta',
    description: 'Creme italiano de baunilha com calda de frutas vermelhas.',
    category: 'sobremesas',
    image: photos.pannaCotta,
    price: 19.9,
  },
  {
    id: 'cannoli',
    name: 'Cannoli',
    description: 'Massa crocante recheada com creme de ricota e pistache.',
    category: 'sobremesas',
    price: 18.9,
    tags: ['novidade'],
  },
];
