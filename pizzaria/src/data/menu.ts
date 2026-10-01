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
    description: 'Italian tomato sauce, mozzarella, fresh tomato, basil and extra-virgin olive oil.',
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
    description: 'Tomato sauce, mozzarella, sliced calabresa sausage, red onion, olives and oregano.',
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
    name: 'Four Cheese',
    description: 'Mozzarella, gorgonzola, parmesan and catupiry cream cheese, finished with oregano.',
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
    name: 'Chicken & Catupiry',
    description: 'House-seasoned shredded chicken, catupiry cream cheese, mozzarella and oregano.',
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
    description: 'Tomato sauce, mozzarella and generous slices of mildly spicy pepperoni.',
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
    description: 'Mozzarella, ham, eggs, onion, peas, olives and oregano.',
    category: 'pizzas',
    image: photos.portuguesa,
    sizes: pizzaPrices({ broto: 42.9, media: 59.9, grande: 74.9 }),
    optionGroups: salgada,
    halfAndHalf: 'salgada',
  },
  {
    id: 'napolitana',
    name: 'Neapolitan',
    description: 'Mozzarella, sliced tomato, grated parmesan, basil and golden garlic.',
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
    description: 'Mozzarella, creamy cheddar, crispy bacon and chives.',
    category: 'pizzas',
    image: photos.baconCheddar,
    sizes: pizzaPrices({ broto: 42.9, media: 59.9, grande: 74.9 }),
    optionGroups: salgada,
    halfAndHalf: 'salgada',
  },
  {
    id: 'mussarela',
    name: 'Mozzarella',
    description: 'Tomato sauce, mozzarella, sliced tomato and oregano.',
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
    name: 'Parma & Arugula',
    description: 'Mozzarella, Parma ham, fresh arugula, cherry tomatoes and parmesan shavings.',
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
    description: 'Peeled tomato sauce, creamy burrata, basil pesto and confit cherry tomatoes.',
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
    description: 'Tomato sauce, mozzarella, spicy salami, chili flakes and a drizzle of hot honey.',
    category: 'especiais',
    image: photos.diavola,
    sizes: pizzaPrices({ broto: 52.9, media: 72.9, grande: 89.9 }),
    optionGroups: salgada,
    tags: ['picante'],
    halfAndHalf: 'salgada',
  },
  {
    id: 'funghi-trufado',
    name: 'Truffle Funghi',
    description: 'Mozzarella, butter-sautéed mixed mushrooms, truffle oil and parmesan.',
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
    description: 'Shredded Brazilian dried beef, catupiry cream cheese, red onion and fresh herbs.',
    category: 'especiais',
    image: photos.carneSeca,
    sizes: pizzaPrices({ broto: 54.9, media: 74.9, grande: 92.9 }),
    optionGroups: salgada,
    halfAndHalf: 'salgada',
  },

  // ------------------------------------------------------------ Pizzas doces
  {
    id: 'chocolate-morango',
    name: 'Chocolate & Strawberry',
    description: 'Creamy milk chocolate, fresh strawberries and chocolate shavings.',
    category: 'doces',
    sizes: pizzaPrices({ broto: 39.9, media: 54.9 }),
    optionGroups: doce,
    tags: ['mais-pedido'],
    halfAndHalf: 'doce',
  },
  {
    id: 'banana-canela',
    name: 'Banana & Cinnamon',
    description: 'Sliced banana, sugar, cinnamon and a drizzle of condensed milk.',
    category: 'doces',
    sizes: pizzaPrices({ broto: 36.9, media: 49.9 }),
    optionGroups: doce,
    halfAndHalf: 'doce',
  },
  {
    id: 'romeu-julieta',
    name: 'Guava & Cheese',
    description: 'Creamy guava paste melted over cheese — the Brazilian classic “Romeu e Julieta”.',
    category: 'doces',
    sizes: pizzaPrices({ broto: 36.9, media: 49.9 }),
    optionGroups: doce,
    halfAndHalf: 'doce',
  },
  {
    id: 'chocolate-coco',
    name: 'Chocolate & Coconut',
    description: 'Chocolate, shredded coconut and condensed milk.',
    category: 'doces',
    sizes: pizzaPrices({ broto: 38.9, media: 52.9 }),
    optionGroups: doce,
    halfAndHalf: 'doce',
  },

  // ------------------------------------------------------------ Combos
  {
    id: 'combo-casal',
    name: 'Date Night Combo',
    description: '1 large classic pizza + 2 canned sodas.',
    category: 'combos',
    image: photos.comboCasal,
    price: 79.9,
    optionGroups: ['combo-pizza-1', 'combo-refri-lata-1', 'combo-refri-lata-2'],
    serves: 'Serves 2',
  },
  {
    id: 'combo-familia',
    name: 'Family Combo',
    description: '2 large classic pizzas + 1 2 L soda.',
    category: 'combos',
    image: photos.frangoCatupiry,
    price: 139.9,
    optionGroups: ['combo-pizza-1', 'combo-pizza-2', 'combo-refri-2l'],
    tags: ['mais-pedido'],
    serves: 'Serves 4–5',
  },
  {
    id: 'combo-salgada-doce',
    name: 'Savory + Sweet Combo',
    description: '1 large classic pizza + 1 small sweet pizza + 1 2 L soda.',
    category: 'combos',
    image: photos.portuguesa,
    price: 114.9,
    optionGroups: ['combo-pizza-1', 'combo-pizza-doce', 'combo-refri-2l'],
    serves: 'Serves 3–4',
  },

  // ------------------------------------------------------------ Bebidas
  {
    id: 'refrigerante',
    name: 'Soda',
    description: '350 ml can or 2 L bottle. Pick your flavor.',
    category: 'bebidas',
    sizes: [
      { id: 'lata', name: 'Can', detail: '350 ml', price: 6.9 },
      { id: '2l', name: 'Bottle', detail: '2 L', price: 15.9 },
    ],
    optionGroups: ['sabor-refrigerante'],
  },
  {
    id: 'suco-natural',
    name: 'Fresh juice',
    description: 'Made to order with real fruit. 500 ml.',
    category: 'bebidas',
    price: 12.9,
    optionGroups: ['sabor-suco'],
  },
  {
    id: 'agua',
    name: 'Mineral water',
    description: '500 ml bottle, still or sparkling.',
    category: 'bebidas',
    price: 4.9,
    optionGroups: ['tipo-agua'],
  },

  // ------------------------------------------------------------ Sobremesas
  {
    id: 'tiramisu',
    name: 'Tiramisù',
    description: 'Coffee-soaked ladyfingers, mascarpone cream and cocoa powder.',
    category: 'sobremesas',
    image: photos.tiramisu,
    price: 22.9,
    tags: ['chef'],
  },
  {
    id: 'petit-gateau',
    name: 'Chocolate lava cake',
    description: 'Warm chocolate cake with a molten center and vanilla ice cream.',
    category: 'sobremesas',
    image: photos.chocolate,
    price: 24.9,
  },
  {
    id: 'panna-cotta',
    name: 'Panna cotta',
    description: 'Italian vanilla cream with a mixed-berry sauce.',
    category: 'sobremesas',
    image: photos.pannaCotta,
    price: 19.9,
  },
  {
    id: 'cannoli',
    name: 'Cannoli',
    description: 'Crisp pastry shells filled with ricotta cream and pistachio.',
    category: 'sobremesas',
    price: 18.9,
    tags: ['novidade'],
  },
];
