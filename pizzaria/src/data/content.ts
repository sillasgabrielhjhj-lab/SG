import { photos } from './images';

/**
 * TEXTOS DO SITE
 * ---------------------------------------------------------------
 * Textos de exemplo, escritos para servir de base. Revise para que
 * reflitam exatamente a história e o processo reais da pizzaria.
 */

export const navigation = [
  { label: 'Home', href: '#home' },
  { label: 'Menu', href: '#menu' },
  { label: 'About', href: '#about' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'Contact', href: '#contact' },
] as const;

export const hero = {
  eyebrow: 'Artisan pizzeria · Delivery & pickup',
  titleStart: 'Pizza worth',
  titleAccent: 'every slice.',
  description:
    'Slow-fermented dough, house-made tomato sauce and hand-picked ingredients. Build your order in a few taps and get it hot at your door.',
  image: photos.hero,
  imageAlt: 'Artisan pizza fresh out of the oven, seen from above',
};

export const marqueeItems = [
  'Margherita',
  'Calabresa',
  'Four Cheese',
  'Parma & Arugula',
  'Pepperoni',
  'Burrata',
  'Truffle Funghi',
  'Chicken & Catupiry',
];

export const about = {
  eyebrow: 'Our story',
  titleStart: 'Handmade,',
  titleAccent: 'the right way.',
  paragraphs: [
    'It all started with a simple idea: make the kind of pizza we would want to eat at home. No shortcuts, no rush, and the same care you would put into cooking for your own family.',
    'Every pizza is still made that way — dough prepared daily, sauce made in house and ingredients chosen with care. What reaches your table is a light, airy crust, perfectly balanced toppings and the kind of flavor that makes you order again.',
  ],
  images: [
    { src: photos.cozinha, alt: 'Pizzas being prepared in the kitchen' },
    { src: photos.margherita, alt: 'Margherita pizza with fresh basil' },
  ],
  pillars: [
    {
      icon: 'wheat',
      title: 'Artisan dough',
      text: 'Slow fermentation for a light, airy and easy-to-digest dough, with a crust that is crisp outside and tender inside.',
    },
    {
      icon: 'leaf',
      title: 'Hand-picked ingredients',
      text: 'Ripe tomatoes, quality cheeses, fresh herbs and cured meats chosen for each recipe.',
    },
    {
      icon: 'flame',
      title: 'A very hot oven',
      text: 'Baked at high heat for just a few minutes — the secret to a golden crust and juicy toppings.',
    },
  ],
} as const;

export const process = {
  eyebrow: 'How we make it',
  title: 'From the dough to your door',
  steps: [
    {
      icon: 'wheat',
      title: 'The dough',
      text: 'Select flour, water, salt and yeast. Kneaded every day, in small batches.',
    },
    {
      icon: 'timer',
      title: 'The rest',
      text: 'The dough rests for hours to develop flavor, lightness and texture.',
    },
    {
      icon: 'chef',
      title: 'The build',
      text: 'Hand-stretched and topped to order, with toppings spread all the way to the edge.',
    },
    {
      icon: 'flame',
      title: 'The oven',
      text: 'Baked at high heat and packed to arrive hot and crispy.',
    },
  ],
} as const;

export const finalCta = {
  title: 'Getting hungry?',
  text: 'Your order is just a few taps away. Choose, customize and send it over WhatsApp.',
  image: photos.pepperoni,
  imageAlt: 'Pepperoni pizza fresh out of the oven',
};
