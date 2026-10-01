import type { Category } from '@/types/menu';

/** Ordem em que as categorias aparecem no cardápio. */
export const categories: Category[] = [
  {
    id: 'pizzas',
    name: 'Pizzas',
    description: 'The classics, done right.',
  },
  {
    id: 'especiais',
    name: 'Signature',
    description: 'House creations with hand-picked ingredients.',
  },
  {
    id: 'doces',
    name: 'Sweet pizzas',
    description: 'End the night on a sweet note.',
  },
  {
    id: 'combos',
    name: 'Combos',
    description: 'More flavor for less. Made for sharing.',
  },
  {
    id: 'bebidas',
    name: 'Drinks',
    description: 'Ice-cold, just the way pizza likes it.',
  },
  {
    id: 'sobremesas',
    name: 'Desserts',
    description: 'The perfect ending.',
  },
];
