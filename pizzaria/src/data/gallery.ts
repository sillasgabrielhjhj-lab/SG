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
  { id: 'g1', src: photos.hero, alt: 'Artisan pizza seen from above', caption: 'Fresh from the oven', layout: 'tall' },
  { id: 'g2', src: photos.salao, alt: 'Inside the pizzeria', caption: 'Our dining room', layout: 'wide' },
  { id: 'g3', src: photos.parmaRucula, alt: 'Parma ham and arugula pizza', caption: 'Parma & Arugula', layout: 'square' },
  { id: 'g4', src: photos.forno, alt: 'Pizza baking in the oven', caption: 'A very hot oven', layout: 'square' },
  { id: 'g5', src: photos.cozinha, alt: 'The pizzeria kitchen at work', caption: 'In the kitchen', layout: 'tall' },
  { id: 'g6', src: photos.pepperoni, alt: 'Pepperoni pizza', caption: 'Pepperoni', layout: 'square' },
  { id: 'g7', src: photos.mesa, alt: 'Table set for dinner', caption: 'Table for two', layout: 'wide' },
  { id: 'g8', src: photos.restaurante, alt: 'Dining room lit up at night', caption: 'By night', layout: 'square' },
];
