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
  tagline: 'Pizzaria artesanal',
  description:
    'Pizzas artesanais com massa de longa fermentação, ingredientes selecionados e entrega rápida. Monte seu pedido em poucos toques e finalize pelo WhatsApp.',
  keywords: [
    'pizzaria',
    'pizza artesanal',
    'delivery de pizza',
    'pizza delivery',
    'pizza meio a meio',
    'pizzaria perto de mim',
  ],

  /** URL pública do site (defina NEXT_PUBLIC_SITE_URL no ambiente de produção). */
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.suapizzaria.com.br',
  locale: 'pt-BR',
  currency: 'BRL',
  /** Fuso usado para calcular "Aberto agora". */
  timeZone: 'America/Sao_Paulo',

  contact: {
    /** WhatsApp que recebe os pedidos: DDI + DDD + número, somente dígitos. */
    whatsapp: '5500000000000',
    /** Telefone como aparece no site. */
    phoneDisplay: '(00) 00000-0000',
    email: 'contato@suapizzaria.com.br',
  },

  address: {
    street: 'Rua Exemplo, 123',
    neighborhood: 'Centro',
    city: 'Sua Cidade',
    state: 'UF',
    zip: '00000-000',
    country: 'BR',
    /** Texto usado para buscar o local no Google Maps (mapa e "Como chegar"). */
    mapsQuery: 'Rua Exemplo, 123 - Centro, Sua Cidade - UF',
    /** Opcional: cole aqui o link "Incorporar mapa" do Google Maps para precisão total. */
    mapsEmbedUrl: '',
    /** Coordenadas opcionais (melhoram o SEO local). */
    geo: null as null | { latitude: number; longitude: number },
  },

  social: {
    instagram: 'https://www.instagram.com/suapizzaria',
    instagramHandle: '@suapizzaria',
    facebook: 'https://www.facebook.com/suapizzaria',
    /** Link para avaliar a pizzaria no Google (Perfil da Empresa). */
    googleReviews: 'https://www.google.com/maps/search/?api=1&query=Sua+Pizzaria',
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
    defaultCity: 'Sua Cidade',
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
