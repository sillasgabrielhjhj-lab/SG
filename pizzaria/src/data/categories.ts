import type { Category } from '@/types/menu';

/** Ordem em que as categorias aparecem no cardápio. */
export const categories: Category[] = [
  {
    id: 'pizzas',
    name: 'Pizzas',
    description: 'As clássicas, feitas do jeito certo.',
  },
  {
    id: 'especiais',
    name: 'Especiais',
    description: 'Criações da casa com ingredientes selecionados.',
  },
  {
    id: 'doces',
    name: 'Pizzas doces',
    description: 'Para terminar a noite com algo doce.',
  },
  {
    id: 'combos',
    name: 'Combos',
    description: 'Mais sabor por menos. Ideais para dividir.',
  },
  {
    id: 'bebidas',
    name: 'Bebidas',
    description: 'Geladas, do jeito que a pizza pede.',
  },
  {
    id: 'sobremesas',
    name: 'Sobremesas',
    description: 'O final perfeito.',
  },
];
