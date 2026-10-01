/**
 * CONFIGURAÇÃO DA PIZZARIA
 * ---------------------------------------------------------------
 * Todas as informações de contato, endereço, horários e entrega ficam aqui.
 * Os valores abaixo são EXEMPLOS (placeholders): substitua pelos dados reais
 * antes de publicar o site.
 */

export interface OpeningHours {
  /** 0 = domingo, 1 = segunda ... 6 = sábado */
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** "HH:MM" (24h). Deixe sem `open`/`close` para dias fechados. */
  open?: string;
  /** Pode passar da meia-noite (ex.: abre 18:00 e fecha 01:00). */
  close?: string;
}

export const siteConfig = {
  name: 'Hunt Brothers Pizza',
  shortName: 'Hunt Brothers',
  tagline: 'Artisan pizzeria',
  description:
    'Artisan pizza made with slow-fermented dough, hand-picked ingredients and fast delivery. Build your order in a few taps and send it over WhatsApp.',
  keywords: [
    'pizzeria',
    'artisan pizza',
    'pizza delivery',
    'pizza takeout',
    'half and half pizza',
    'pizza near me',
  ],

  /** URL pública do site (defina NEXT_PUBLIC_SITE_URL no ambiente de produção). */
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yourpizzeria.com',
  locale: 'en-US',
  currency: 'BRL',
  /** Fuso usado para calcular "Aberto agora". */
  timeZone: 'America/Sao_Paulo',

  contact: {
    /** WhatsApp que recebe os pedidos: DDI + DDD + número, somente dígitos. */
    whatsapp: '5500000000000',
    /** Telefone como aparece no site. */
    phoneDisplay: '(00) 00000-0000',
    email: 'hello@yourpizzeria.com',
  },

  address: {
    street: '123 Example Street',
    neighborhood: 'Downtown',
    city: 'Your City',
    state: 'ST',
    zip: '00000-000',
    country: 'BR',
    /** Texto usado para buscar o local no Google Maps (mapa e "Como chegar"). */
    mapsQuery: '123 Example Street, Downtown, Your City',
    /** Opcional: cole aqui o link "Incorporar mapa" do Google Maps para precisão total. */
    mapsEmbedUrl: '',
    /** Coordenadas opcionais (melhoram o SEO local). */
    geo: null as null | { latitude: number; longitude: number },
  },

  social: {
    instagram: 'https://www.instagram.com/yourpizzeria',
    instagramHandle: '@yourpizzeria',
    facebook: 'https://www.facebook.com/yourpizzeria',
    /** Link para avaliar a pizzaria no Google (Perfil da Empresa). */
    googleReviews: 'https://www.google.com/maps/search/?api=1&query=Your+Pizzeria',
  },

  delivery: {
    /** Taxa de entrega padrão, em reais. */
    fee: 8,
    /** Pedidos a partir deste valor têm entrega grátis (use null para desativar). */
    freeFrom: 120 as number | null,
    /** Valor mínimo do pedido, em reais (use 0 para desativar). */
    minimumOrder: 35,
    /** Tempo médio exibido no site. */
    estimate: '40–60 min',
    pickupEstimate: '20–30 min',
    /** Cidade sugerida no formulário de endereço. */
    defaultCity: 'Your City',
  },

  ordering: {
    /** Permite montar o pedido mesmo com a pizzaria fechada (mostramos um aviso). */
    allowWhenClosed: true,
  },

  hours: [
    { day: 0, open: '18:00', close: '23:30' },
    { day: 1 },
    { day: 2, open: '18:00', close: '23:00' },
    { day: 3, open: '18:00', close: '23:00' },
    { day: 4, open: '18:00', close: '23:00' },
    { day: 5, open: '18:00', close: '00:00' },
    { day: 6, open: '18:00', close: '00:00' },
  ] as OpeningHours[],

  /** Faixa de preço para o Google (de $ a $$$$). */
  priceRange: '$$',
};

export type SiteConfig = typeof siteConfig;

/** Verdadeiro enquanto o número de WhatsApp ainda é o placeholder. */
export const isWhatsAppPlaceholder = /^(55)?0+$/.test(siteConfig.contact.whatsapp);
