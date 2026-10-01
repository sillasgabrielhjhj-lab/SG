import { photos } from './images';

/**
 * GALERIA
 * ---------------------------------------------------------------
 * Fotos de pizzas, cozinha e ambiente. `layout` controla o tamanho
 * do bloco na grade: 'tall' (vertical), 'wide' (horizontal) ou 'square'.
 */

export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  caption: string;
  layout: 'tall' | 'wide' | 'square';
}

export const gallery: GalleryItem[] = [
  { id: 'g1', src: photos.hero, alt: 'Pizza artesanal vista de cima', caption: 'Saindo do forno', layout: 'tall' },
  { id: 'g2', src: photos.salao, alt: 'Ambiente da pizzaria', caption: 'Nosso salão', layout: 'wide' },
  { id: 'g3', src: photos.parmaRucula, alt: 'Pizza de parma com rúcula', caption: 'Parma & Rúcula', layout: 'square' },
  { id: 'g4', src: photos.forno, alt: 'Pizza assando no forno', caption: 'Forno bem quente', layout: 'square' },
  { id: 'g5', src: photos.cozinha, alt: 'Cozinha da pizzaria em preparo', caption: 'Na cozinha', layout: 'tall' },
  { id: 'g6', src: photos.pepperoni, alt: 'Pizza de pepperoni', caption: 'Pepperoni', layout: 'square' },
  { id: 'g7', src: photos.mesa, alt: 'Mesa posta para o jantar', caption: 'Mesa posta', layout: 'wide' },
  { id: 'g8', src: photos.restaurante, alt: 'Salão iluminado à noite', caption: 'À noite', layout: 'square' },
];
