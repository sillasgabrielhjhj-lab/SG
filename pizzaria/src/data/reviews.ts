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
  /** Ex.: "Cliente desde 2024 · via Google" */
  source: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  /** Mostra o selo "Exemplo" no card. */
  placeholder: boolean;
}

export const reviews: Review[] = [
  {
    id: 'r1',
    name: 'Nome do cliente',
    source: 'Avaliação via Google',
    rating: 5,
    text: 'Espaço reservado para um depoimento real sobre o sabor e a massa das pizzas. Copie aqui uma avaliação verdadeira de um cliente.',
    placeholder: true,
  },
  {
    id: 'r2',
    name: 'Nome do cliente',
    source: 'Avaliação via iFood',
    rating: 5,
    text: 'Espaço reservado para um depoimento real sobre a entrega: tempo, temperatura da pizza e cuidado com a embalagem.',
    placeholder: true,
  },
  {
    id: 'r3',
    name: 'Nome do cliente',
    source: 'Avaliação via Instagram',
    rating: 5,
    text: 'Espaço reservado para um depoimento real sobre o atendimento e a experiência de pedir pelo WhatsApp.',
    placeholder: true,
  },
  {
    id: 'r4',
    name: 'Nome do cliente',
    source: 'Avaliação via Google',
    rating: 5,
    text: 'Espaço reservado para um depoimento real sobre uma pizza especial ou um sabor favorito do cardápio.',
    placeholder: true,
  },
  {
    id: 'r5',
    name: 'Nome do cliente',
    source: 'Avaliação via Google',
    rating: 5,
    text: 'Espaço reservado para um depoimento real sobre o custo-benefício dos combos e o tamanho das pizzas.',
    placeholder: true,
  },
  {
    id: 'r6',
    name: 'Nome do cliente',
    source: 'Avaliação via iFood',
    rating: 5,
    text: 'Espaço reservado para um depoimento real sobre as sobremesas ou as pizzas doces.',
    placeholder: true,
  },
];
