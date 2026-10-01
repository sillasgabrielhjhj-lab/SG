import type { OptionGroup, SizeOption } from '@/types/menu';

/**
 * TAMANHOS E OPÇÕES
 * ---------------------------------------------------------------
 * Tamanhos padrão das pizzas e grupos de opções (bordas, adicionais,
 * sabores). Os preços aqui são EXEMPLOS: ajuste à realidade da pizzaria.
 */

/** Tamanhos padrão das pizzas salgadas (os preços ficam em cada pizza). */
export const pizzaSizeInfo = {
  broto: { name: 'Small', detail: '4 slices · 25 cm' },
  media: { name: 'Medium', detail: '6 slices · 30 cm' },
  grande: { name: 'Large', detail: '8 slices · 35 cm' },
} as const;

type PizzaSizeId = keyof typeof pizzaSizeInfo;

/** Atalho para declarar os preços de uma pizza por tamanho. */
export function pizzaPrices(prices: Partial<Record<PizzaSizeId, number>>): SizeOption[] {
  return (Object.keys(pizzaSizeInfo) as PizzaSizeId[])
    .filter((id) => prices[id] !== undefined)
    .map((id) => ({ id, ...pizzaSizeInfo[id], price: prices[id] as number }));
}

export const optionGroups: Record<string, OptionGroup> = {
  'borda-salgada': {
    id: 'borda-salgada',
    title: 'Crust',
    type: 'single',
    required: true,
    defaultOptionId: 'tradicional',
    options: [
      { id: 'tradicional', name: 'Classic', price: 0 },
      { id: 'catupiry', name: 'Catupiry-stuffed', price: 9 },
      { id: 'cheddar', name: 'Cheddar-stuffed', price: 9 },
      { id: 'cream-cheese', name: 'Cream cheese-stuffed', price: 10 },
    ],
  },
  'borda-doce': {
    id: 'borda-doce',
    title: 'Crust',
    type: 'single',
    required: true,
    defaultOptionId: 'tradicional',
    options: [
      { id: 'tradicional', name: 'Classic', price: 0 },
      { id: 'chocolate', name: 'Chocolate-stuffed', price: 10 },
      { id: 'doce-de-leite', name: 'Dulce de leche-stuffed', price: 10 },
    ],
  },
  'adicionais-salgados': {
    id: 'adicionais-salgados',
    title: 'Extra toppings',
    type: 'multiple',
    max: 5,
    options: [
      { id: 'mussarela', name: 'Extra mozzarella', price: 8 },
      { id: 'bacon', name: 'Crispy bacon', price: 9 },
      { id: 'calabresa', name: 'Calabresa sausage', price: 8 },
      { id: 'pepperoni', name: 'Pepperoni', price: 10 },
      { id: 'cebola-caramelizada', name: 'Caramelized onions', price: 6 },
      { id: 'azeitona', name: 'Black olives', price: 5 },
      { id: 'rucula', name: 'Fresh arugula', price: 5 },
      { id: 'burrata', name: 'Burrata', price: 18 },
    ],
  },
  'adicionais-doces': {
    id: 'adicionais-doces',
    title: 'Extra toppings',
    type: 'multiple',
    max: 3,
    options: [
      { id: 'morango', name: 'Fresh strawberries', price: 8 },
      { id: 'leite-em-po', name: 'Powdered milk', price: 5 },
      { id: 'creme-avela', name: 'Hazelnut spread', price: 10 },
      { id: 'granulado', name: 'Chocolate sprinkles', price: 4 },
    ],
  },
  'sabor-refrigerante': {
    id: 'sabor-refrigerante',
    title: 'Flavor',
    type: 'single',
    required: true,
    options: [
      { id: 'cola', name: 'Cola', price: 0 },
      { id: 'cola-zero', name: 'Zero-sugar cola', price: 0 },
      { id: 'guarana', name: 'Guaraná', price: 0 },
      { id: 'guarana-zero', name: 'Zero-sugar guaraná', price: 0 },
      { id: 'laranja', name: 'Orange', price: 0 },
    ],
  },
  'sabor-suco': {
    id: 'sabor-suco',
    title: 'Flavor',
    type: 'single',
    required: true,
    options: [
      { id: 'laranja', name: 'Orange', price: 0 },
      { id: 'limao', name: 'Lime', price: 0 },
      { id: 'maracuja', name: 'Passion fruit', price: 0 },
      { id: 'abacaxi-hortela', name: 'Pineapple & mint', price: 0 },
    ],
  },
  'tipo-agua': {
    id: 'tipo-agua',
    title: 'Type',
    type: 'single',
    required: true,
    defaultOptionId: 'sem-gas',
    options: [
      { id: 'sem-gas', name: 'Still', price: 0 },
      { id: 'com-gas', name: 'Sparkling', price: 0 },
    ],
  },
  'combo-pizza-1': {
    id: 'combo-pizza-1',
    title: '1st pizza flavor',
    type: 'single',
    required: true,
    fromCategory: 'pizzas',
  },
  'combo-pizza-2': {
    id: 'combo-pizza-2',
    title: '2nd pizza flavor',
    type: 'single',
    required: true,
    fromCategory: 'pizzas',
  },
  'combo-pizza-doce': {
    id: 'combo-pizza-doce',
    title: 'Sweet pizza flavor (small)',
    type: 'single',
    required: true,
    fromCategory: 'doces',
  },
  'combo-refri-lata-1': {
    id: 'combo-refri-lata-1',
    title: '1st soda (can)',
    type: 'single',
    required: true,
    defaultOptionId: 'cola',
    options: [
      { id: 'cola', name: 'Cola', price: 0 },
      { id: 'cola-zero', name: 'Zero-sugar cola', price: 0 },
      { id: 'guarana', name: 'Guaraná', price: 0 },
    ],
  },
  'combo-refri-lata-2': {
    id: 'combo-refri-lata-2',
    title: '2nd soda (can)',
    type: 'single',
    required: true,
    defaultOptionId: 'guarana',
    options: [
      { id: 'cola', name: 'Cola', price: 0 },
      { id: 'cola-zero', name: 'Zero-sugar cola', price: 0 },
      { id: 'guarana', name: 'Guaraná', price: 0 },
    ],
  },
  'combo-refri-2l': {
    id: 'combo-refri-2l',
    title: '2 L soda',
    type: 'single',
    required: true,
    defaultOptionId: 'cola',
    options: [
      { id: 'cola', name: 'Cola', price: 0 },
      { id: 'cola-zero', name: 'Zero-sugar cola', price: 0 },
      { id: 'guarana', name: 'Guaraná', price: 0 },
    ],
  },
};
