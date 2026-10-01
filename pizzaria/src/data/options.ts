import type { OptionGroup, SizeOption } from '@/types/menu';

/**
 * TAMANHOS E OPÇÕES
 * ---------------------------------------------------------------
 * Tamanhos padrão das pizzas e grupos de opções (bordas, adicionais,
 * sabores). Os preços aqui são EXEMPLOS: ajuste à realidade da pizzaria.
 */

/** Tamanhos padrão das pizzas salgadas (os preços ficam em cada pizza). */
export const pizzaSizeInfo = {
  broto: { name: 'Broto', detail: '4 fatias · 25 cm' },
  media: { name: 'Média', detail: '6 fatias · 30 cm' },
  grande: { name: 'Grande', detail: '8 fatias · 35 cm' },
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
    title: 'Borda',
    type: 'single',
    required: true,
    defaultOptionId: 'tradicional',
    options: [
      { id: 'tradicional', name: 'Tradicional', price: 0 },
      { id: 'catupiry', name: 'Recheada com catupiry', price: 9 },
      { id: 'cheddar', name: 'Recheada com cheddar', price: 9 },
      { id: 'cream-cheese', name: 'Recheada com cream cheese', price: 10 },
    ],
  },
  'borda-doce': {
    id: 'borda-doce',
    title: 'Borda',
    type: 'single',
    required: true,
    defaultOptionId: 'tradicional',
    options: [
      { id: 'tradicional', name: 'Tradicional', price: 0 },
      { id: 'chocolate', name: 'Recheada com chocolate', price: 10 },
      { id: 'doce-de-leite', name: 'Recheada com doce de leite', price: 10 },
    ],
  },
  'adicionais-salgados': {
    id: 'adicionais-salgados',
    title: 'Adicionais',
    type: 'multiple',
    max: 5,
    options: [
      { id: 'mussarela', name: 'Mussarela extra', price: 8 },
      { id: 'bacon', name: 'Bacon crocante', price: 9 },
      { id: 'calabresa', name: 'Calabresa', price: 8 },
      { id: 'pepperoni', name: 'Pepperoni', price: 10 },
      { id: 'cebola-caramelizada', name: 'Cebola caramelizada', price: 6 },
      { id: 'azeitona', name: 'Azeitonas pretas', price: 5 },
      { id: 'rucula', name: 'Rúcula fresca', price: 5 },
      { id: 'burrata', name: 'Burrata', price: 18 },
    ],
  },
  'adicionais-doces': {
    id: 'adicionais-doces',
    title: 'Adicionais',
    type: 'multiple',
    max: 3,
    options: [
      { id: 'morango', name: 'Morangos frescos', price: 8 },
      { id: 'leite-em-po', name: 'Leite em pó', price: 5 },
      { id: 'creme-avela', name: 'Creme de avelã', price: 10 },
      { id: 'granulado', name: 'Granulado', price: 4 },
    ],
  },
  'sabor-refrigerante': {
    id: 'sabor-refrigerante',
    title: 'Sabor',
    type: 'single',
    required: true,
    options: [
      { id: 'cola', name: 'Cola', price: 0 },
      { id: 'cola-zero', name: 'Cola zero', price: 0 },
      { id: 'guarana', name: 'Guaraná', price: 0 },
      { id: 'guarana-zero', name: 'Guaraná zero', price: 0 },
      { id: 'laranja', name: 'Laranja', price: 0 },
    ],
  },
  'sabor-suco': {
    id: 'sabor-suco',
    title: 'Sabor',
    type: 'single',
    required: true,
    options: [
      { id: 'laranja', name: 'Laranja', price: 0 },
      { id: 'limao', name: 'Limão', price: 0 },
      { id: 'maracuja', name: 'Maracujá', price: 0 },
      { id: 'abacaxi-hortela', name: 'Abacaxi com hortelã', price: 0 },
    ],
  },
  'tipo-agua': {
    id: 'tipo-agua',
    title: 'Tipo',
    type: 'single',
    required: true,
    defaultOptionId: 'sem-gas',
    options: [
      { id: 'sem-gas', name: 'Sem gás', price: 0 },
      { id: 'com-gas', name: 'Com gás', price: 0 },
    ],
  },
  'combo-pizza-1': {
    id: 'combo-pizza-1',
    title: 'Sabor da 1ª pizza',
    type: 'single',
    required: true,
    fromCategory: 'pizzas',
  },
  'combo-pizza-2': {
    id: 'combo-pizza-2',
    title: 'Sabor da 2ª pizza',
    type: 'single',
    required: true,
    fromCategory: 'pizzas',
  },
  'combo-pizza-doce': {
    id: 'combo-pizza-doce',
    title: 'Sabor da pizza doce (broto)',
    type: 'single',
    required: true,
    fromCategory: 'doces',
  },
  'combo-refri-lata-1': {
    id: 'combo-refri-lata-1',
    title: '1º refrigerante (lata)',
    type: 'single',
    required: true,
    defaultOptionId: 'cola',
    options: [
      { id: 'cola', name: 'Cola', price: 0 },
      { id: 'cola-zero', name: 'Cola zero', price: 0 },
      { id: 'guarana', name: 'Guaraná', price: 0 },
    ],
  },
  'combo-refri-lata-2': {
    id: 'combo-refri-lata-2',
    title: '2º refrigerante (lata)',
    type: 'single',
    required: true,
    defaultOptionId: 'guarana',
    options: [
      { id: 'cola', name: 'Cola', price: 0 },
      { id: 'cola-zero', name: 'Cola zero', price: 0 },
      { id: 'guarana', name: 'Guaraná', price: 0 },
    ],
  },
  'combo-refri-2l': {
    id: 'combo-refri-2l',
    title: 'Refrigerante 2 L',
    type: 'single',
    required: true,
    defaultOptionId: 'cola',
    options: [
      { id: 'cola', name: 'Cola', price: 0 },
      { id: 'cola-zero', name: 'Cola zero', price: 0 },
      { id: 'guarana', name: 'Guaraná', price: 0 },
    ],
  },
};
