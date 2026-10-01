// Dados de demonstração para montar o layout antes da integração com o
// banco (Fase 2). Os formatos aqui espelham o que as queries Prisma reais
// vão devolver, para a troca ser direta.

export type MockCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
};

export const categories: MockCategory[] = [
  { id: "c1", name: "Eletrônicos", slug: "eletronicos", icon: "Smartphone" },
  { id: "c2", name: "Celulares", slug: "celulares", icon: "Smartphone" },
  { id: "c3", name: "Informática", slug: "informatica", icon: "Laptop" },
  { id: "c4", name: "Casa", slug: "casa", icon: "Sofa" },
  { id: "c5", name: "Moda", slug: "moda", icon: "Shirt" },
  { id: "c6", name: "Beleza", slug: "beleza", icon: "Sparkles" },
  { id: "c7", name: "Esportes", slug: "esportes", icon: "Dumbbell" },
  { id: "c8", name: "Automóveis", slug: "automoveis", icon: "Car" },
  { id: "c9", name: "Ferramentas", slug: "ferramentas", icon: "Wrench" },
  { id: "c10", name: "Games", slug: "games", icon: "Gamepad2" },
  { id: "c11", name: "Livros", slug: "livros", icon: "BookOpen" },
];

export type MockProduct = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  compareAtPriceCents?: number;
  ratingAvg: number;
  ratingCount: number;
  imageUrl: string;
  sellerName: string;
  freeShipping?: boolean;
};

const placeholderImg = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `/placeholders/ph-${hash % 48}.svg`;
};

export const bestSellers: MockProduct[] = Array.from({ length: 10 }).map(
  (_, i) => ({
    id: `best-${i}`,
    slug: `produto-mais-vendido-${i}`,
    name: [
      "Fone de Ouvido Bluetooth Pro",
      "Smartwatch Fit 2",
      "Cafeteira Elétrica Inox",
      "Mochila Executiva Impermeável",
      "Luminária de Mesa LED",
      "Teclado Mecânico RGB",
      "Caixa de Som Portátil",
      "Kit Panelas Antiaderente",
      "Tênis Esportivo Runner",
      "Mouse Gamer sem Fio",
    ][i],
    priceCents: [18990, 34990, 15990, 12990, 8990, 22990, 19990, 29990, 24990, 13990][i],
    compareAtPriceCents: i % 3 === 0 ? [24990, 44990, 19990, 16990][i % 4] : undefined,
    ratingAvg: 4 + ((i % 10) / 10),
    ratingCount: 120 + i * 37,
    imageUrl: placeholderImg(`best-${i}`),
    sellerName: ["TechStore", "CasaBoa", "UrbanFit", "GamerZone"][i % 4],
    freeShipping: i % 2 === 0,
  }),
);

export const recommended: MockProduct[] = Array.from({ length: 10 }).map(
  (_, i) => ({
    id: `rec-${i}`,
    slug: `produto-recomendado-${i}`,
    name: [
      "Cadeira de Escritório Ergonômica",
      "Carregador Rápido 65W",
      "Jaqueta Jeans Unissex",
      "Panela Elétrica de Arroz",
      "Headset Gamer Surround",
      "Garrafa Térmica 1L",
      "Monitor 27'' Full HD",
      "Perfume Importado 100ml",
      "Bicicleta Aro 29",
      "Livro Best-seller Capa Dura",
    ][i],
    priceCents: [59990, 9990, 15990, 27990, 29990, 7990, 89990, 24990, 129990, 4990][i],
    ratingAvg: 3.8 + ((i % 12) / 10),
    ratingCount: 40 + i * 21,
    imageUrl: placeholderImg(`rec-${i}`),
    sellerName: ["OfficePlus", "PowerMax", "ModaViva", "LivrariaCentral"][i % 4],
    freeShipping: i % 3 !== 0,
  }),
);

export const deals: MockProduct[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `deal-${i}`,
  slug: `oferta-relampago-${i}`,
  name: [
    "Smart TV 50'' 4K",
    "Air Fryer Digital 5L",
    "Ventilador de Torre",
    "Relógio Digital Esportivo",
    "Furadeira Parafusadeira",
    "Microondas 20L",
    "Capa + Película Smartphone",
    "Echo Dot Assistente Virtual",
  ][i],
  priceCents: [189990, 29990, 19990, 11990, 24990, 59990, 3990, 29990][i],
  compareAtPriceCents: [259990, 39990, 27990, 17990, 34990, 79990, 6990, 39990][i],
  ratingAvg: 4.2 + ((i % 8) / 10),
  ratingCount: 200 + i * 44,
  imageUrl: placeholderImg(`deal-${i}`),
  sellerName: ["MegaEletro", "CasaBoa", "TechStore"][i % 3],
  freeShipping: true,
}));

export const benefits = [
  {
    icon: "Truck",
    title: "Entrega rápida",
    description: "Receba em todo o Brasil com prazos claros antes de comprar.",
  },
  {
    icon: "ShieldCheck",
    title: "Compra protegida",
    description: "Reembolso garantido se o produto não chegar ou vier diferente.",
  },
  {
    icon: "BadgePercent",
    title: "Parcelamento sem juros",
    description: "Em até 12x nos cartões de crédito participantes.",
  },
  {
    icon: "Headset",
    title: "Suporte dedicado",
    description: "Atendimento humano para resolver qualquer problema com o pedido.",
  },
];
