/**
 * AVALIAÇÕES
 * ---------------------------------------------------------------
 * ATENÇÃO: os itens abaixo são PLACEHOLDERS. Não publique depoimentos
 * inventados. Substitua por avaliações reais de clientes (Google, iFood,
 * Instagram), com autorização, e altere `placeholder` para `false`.
 */

export interface Review {
  id: string;
  name: string;
  /** Ex.: "Customer since 2024 · on Google" */
  source: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  /** Mostra o selo "Exemplo" no card. */
  placeholder: boolean;
}

export const reviews: Review[] = [
  {
    id: 'r1',
    name: 'Customer name',
    source: 'Review on Google',
    rating: 5,
    text: 'Placeholder for a real testimonial about the flavor and the dough. Paste a genuine customer review here.',
    placeholder: true,
  },
  {
    id: 'r2',
    name: 'Customer name',
    source: 'Review on iFood',
    rating: 5,
    text: 'Placeholder for a real testimonial about delivery: timing, how hot the pizza arrived and the packaging.',
    placeholder: true,
  },
  {
    id: 'r3',
    name: 'Customer name',
    source: 'Review on Instagram',
    rating: 5,
    text: 'Placeholder for a real testimonial about the service and ordering through WhatsApp.',
    placeholder: true,
  },
  {
    id: 'r4',
    name: 'Customer name',
    source: 'Review on Google',
    rating: 5,
    text: 'Placeholder for a real testimonial about a signature pizza or a favorite flavor.',
    placeholder: true,
  },
  {
    id: 'r5',
    name: 'Customer name',
    source: 'Review on Google',
    rating: 5,
    text: 'Placeholder for a real testimonial about combo value and pizza sizes.',
    placeholder: true,
  },
  {
    id: 'r6',
    name: 'Customer name',
    source: 'Review on iFood',
    rating: 5,
    text: 'Placeholder for a real testimonial about the desserts or sweet pizzas.',
    placeholder: true,
  },
];
