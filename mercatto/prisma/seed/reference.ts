import type { PrismaClient } from "../../src/generated/prisma/client";

/** Dados de referência — usados em produção (minimal) e desenvolvimento (demo). */

type Attr = { key: string; name: string; type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN"; options?: string[]; unit?: string; filterable?: boolean };
type Cat = { slug: string; name: string; icon: string; featured?: boolean; description: string; attrs?: Attr[]; children: { slug: string; name: string; icon: string; attrs?: Attr[] }[] };

const STORAGE = ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];
const RAM = ["4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "32 GB"];
const VOLT = ["110V", "220V", "Bivolt"];

export const CATEGORY_TREE: Cat[] = [
  {
    slug: "celulares", name: "Celulares", icon: "Smartphone", featured: true, description: "Smartphones, smartwatches e fones das melhores marcas.",
    attrs: [
      { key: "armazenamento", name: "Armazenamento", type: "SELECT", options: STORAGE, filterable: true },
      { key: "memoria_ram", name: "Memória RAM", type: "SELECT", options: RAM, filterable: true },
      { key: "rede_5g", name: "5G", type: "SELECT", options: ["Sim", "Não"], filterable: true },
    ],
    children: [
      { slug: "smartphones", name: "Smartphones", icon: "Smartphone" },
      { slug: "smartwatches", name: "Smartwatches", icon: "Watch" },
      { slug: "fones-de-ouvido", name: "Fones de ouvido", icon: "Headphones" },
    ],
  },
  {
    slug: "informatica", name: "Informática", icon: "Laptop", featured: true, description: "Notebooks, monitores, periféricos e tablets.",
    attrs: [
      { key: "processador", name: "Processador", type: "SELECT", options: ["Intel Core i3", "Intel Core i5", "Intel Core i7", "AMD Ryzen 5", "AMD Ryzen 7", "Apple M3", "Apple M4"], filterable: true },
      { key: "memoria_ram", name: "Memória RAM", type: "SELECT", options: RAM, filterable: true },
      { key: "tela", name: "Tela", type: "SELECT", options: ['11"', '13"', '14"', '15,6"', '24"', '27"'], filterable: true },
    ],
    children: [
      { slug: "notebooks", name: "Notebooks", icon: "Laptop" },
      { slug: "monitores", name: "Monitores", icon: "Monitor" },
      { slug: "perifericos", name: "Periféricos", icon: "Keyboard" },
      { slug: "tablets", name: "Tablets", icon: "Tablet" },
    ],
  },
  {
    slug: "games", name: "Games", icon: "Gamepad2", featured: true, description: "Consoles, controles e acessórios gamer.",
    attrs: [{ key: "plataforma", name: "Plataforma", type: "SELECT", options: ["PlayStation", "Xbox", "Nintendo Switch", "PC"], filterable: true }],
    children: [
      { slug: "consoles", name: "Consoles", icon: "Gamepad2" },
      { slug: "controles", name: "Controles", icon: "Joystick" },
      { slug: "headsets-gamer", name: "Headsets gamer", icon: "Headset" },
    ],
  },
  {
    slug: "tv-e-audio", name: "TV e Áudio", icon: "Tv", featured: true, description: "Smart TVs, soundbars e caixas de som.",
    attrs: [
      { key: "tamanho_tela", name: "Tamanho da tela", type: "SELECT", options: ['43"', '50"', '55"', '65"', '75"'], filterable: true },
      { key: "resolucao", name: "Resolução", type: "SELECT", options: ["Full HD", "4K", "8K"], filterable: true },
    ],
    children: [
      { slug: "smart-tvs", name: "Smart TVs", icon: "Tv" },
      { slug: "soundbars", name: "Soundbars", icon: "Speaker" },
      { slug: "caixas-de-som", name: "Caixas de som", icon: "Speaker" },
      { slug: "headphones", name: "Headphones", icon: "Headphones" },
    ],
  },
  {
    slug: "eletrodomesticos", name: "Eletrodomésticos", icon: "Refrigerator", featured: true, description: "Geladeiras, lavadoras, cozinha e limpeza.",
    attrs: [{ key: "voltagem", name: "Voltagem", type: "SELECT", options: VOLT, filterable: true }],
    children: [
      { slug: "geladeiras", name: "Geladeiras", icon: "Refrigerator" },
      { slug: "lavadoras", name: "Lavadoras", icon: "WashingMachine" },
      { slug: "micro-ondas", name: "Micro-ondas", icon: "Microwave" },
      { slug: "air-fryers", name: "Air fryers", icon: "CookingPot" },
      { slug: "liquidificadores", name: "Liquidificadores", icon: "Blend" },
      { slug: "cafeteiras", name: "Cafeteiras", icon: "Coffee" },
      { slug: "aspiradores", name: "Aspiradores", icon: "Fan" },
    ],
  },
  {
    slug: "casa", name: "Casa", icon: "Sofa", featured: true, description: "Móveis, iluminação e utilidades para a cozinha.",
    children: [
      { slug: "moveis", name: "Móveis", icon: "Sofa" },
      { slug: "iluminacao", name: "Iluminação", icon: "Lamp" },
      { slug: "cozinha", name: "Cozinha", icon: "CookingPot" },
    ],
  },
  {
    slug: "moda", name: "Moda", icon: "Shirt", featured: true, description: "Roupas, calçados e acessórios.",
    attrs: [{ key: "genero", name: "Gênero", type: "SELECT", options: ["Masculino", "Feminino", "Unissex"], filterable: true }],
    children: [
      { slug: "camisetas", name: "Camisetas", icon: "Shirt" },
      { slug: "tenis", name: "Tênis", icon: "Footprints" },
      { slug: "mochilas", name: "Mochilas", icon: "Backpack" },
      { slug: "relogios", name: "Relógios", icon: "Watch" },
      { slug: "oculos", name: "Óculos", icon: "Glasses" },
    ],
  },
  {
    slug: "beleza", name: "Beleza", icon: "Sparkles", featured: true, description: "Perfumes, skincare e cuidados com os cabelos.",
    children: [
      { slug: "perfumes", name: "Perfumes", icon: "SprayCan" },
      { slug: "skincare", name: "Skincare", icon: "Droplet" },
      { slug: "cabelos", name: "Cabelos", icon: "Wind" },
    ],
  },
  {
    slug: "automotivo", name: "Automotivo", icon: "Car", description: "Pneus e acessórios automotivos.",
    attrs: [{ key: "aro", name: "Aro", type: "SELECT", options: ["13", "14", "15", "16", "17", "18"], filterable: true }],
    children: [
      { slug: "pneus", name: "Pneus", icon: "CircleDot" },
      { slug: "acessorios-automotivos", name: "Acessórios", icon: "Car" },
    ],
  },
  {
    slug: "ferramentas", name: "Ferramentas", icon: "Wrench", description: "Ferramentas elétricas e organização.",
    attrs: [{ key: "voltagem", name: "Voltagem", type: "SELECT", options: VOLT, filterable: true }],
    children: [
      { slug: "ferramentas-eletricas", name: "Ferramentas elétricas", icon: "Drill" },
      { slug: "organizacao", name: "Organização", icon: "Toolbox" },
    ],
  },
  {
    slug: "esportes", name: "Esportes", icon: "Dumbbell", description: "Bicicletas, musculação, yoga e futebol.",
    children: [
      { slug: "bicicletas", name: "Bicicletas", icon: "Bike" },
      { slug: "musculacao", name: "Musculação", icon: "Dumbbell" },
      { slug: "yoga", name: "Yoga e pilates", icon: "PersonStanding" },
      { slug: "futebol", name: "Futebol", icon: "Volleyball" },
    ],
  },
];

export const BRANDS: [slug: string, name: string, featured?: boolean][] = [
  ["apple", "Apple", true], ["samsung", "Samsung", true], ["motorola", "Motorola", true], ["xiaomi", "Xiaomi", true], ["sony", "Sony", true],
  ["lg", "LG", true], ["philips", "Philips"], ["jbl", "JBL", true], ["dell", "Dell"], ["lenovo", "Lenovo", true], ["acer", "Acer"],
  ["asus", "Asus"], ["logitech", "Logitech", true], ["microsoft", "Microsoft"], ["nintendo", "Nintendo", true], ["brastemp", "Brastemp"],
  ["electrolux", "Electrolux", true], ["mondial", "Mondial"], ["arno", "Arno"], ["britania", "Britânia"], ["nike", "Nike", true],
  ["adidas", "Adidas", true], ["olympikus", "Olympikus"], ["natura", "Natura", true], ["boticario", "O Boticário"], ["bosch", "Bosch"],
  ["makita", "Makita"], ["pirelli", "Pirelli"], ["caloi", "Caloi"], ["tramontina", "Tramontina", true], ["mercatto-essentials", "Mercatto Essentials", true],
];

/** Regras de frete globais (fallback de todas as lojas). Valores realistas em centavos. */
export function globalShippingRules() {
  const brackets = [500, 1000, 2000, 5000, 10000, 30000];
  const table = {
    SAME_STATE: { Padrão: [1490, 1690, 1990, 2690, 3490, 5990], Expresso: [2290, 2590, 2990, 3990, 5290, 8990], days: { Padrão: [2, 4], Expresso: [1, 2] } },
    SAME_REGION: { Padrão: [1990, 2290, 2690, 3490, 4690, 7990], Expresso: [2990, 3390, 3890, 5190, 6890, 11990], days: { Padrão: [3, 6], Expresso: [2, 3] } },
    OTHER: { Padrão: [2490, 2890, 3390, 4490, 5990, 9990], Expresso: [3990, 4490, 5190, 6890, 8990, 14990], days: { Padrão: [5, 10], Expresso: [3, 5] } },
  } as const;
  const rows: { name: string; regionCode: string; maxWeightGrams: number; priceCents: number; additionalKgCents: number; minDays: number; maxDays: number }[] = [];
  for (const [regionCode, cfg] of Object.entries(table)) {
    for (const service of ["Padrão", "Expresso"] as const) {
      brackets.forEach((w, i) => {
        rows.push({ name: service, regionCode, maxWeightGrams: w, priceCents: cfg[service][i]!, additionalKgCents: service === "Padrão" ? 290 : 450, minDays: cfg.days[service][0], maxDays: cfg.days[service][1] });
      });
    }
  }
  return rows;
}

export async function seedReference(db: PrismaClient) {
  await db.storeSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      storeName: "Mercatto",
      tagline: "Compre com confiança. Receba com rapidez.",
      contactEmail: "atendimento@mercatto.com.br",
      contactPhone: "4000-0000",
      whatsapp: "11900000000",
      socialLinks: { instagram: "https://instagram.com/", facebook: "https://facebook.com/", tiktok: "https://tiktok.com/", youtube: "https://youtube.com/", x: null },
      seoTitle: "Mercatto — compre com confiança",
      seoDescription: "Marketplace brasileiro com ofertas oficiais Mercatto e lojas parceiras verificadas. PIX, parcelamento e entrega para todo o Brasil.",
      minOrderCents: 0,
      freeShippingThresholdCents: 19900,
      lowStockThreshold: 5,
      orderReservationMinutes: 30,
      pixDiscountPercent: 0,
      maxInstallments: 12,
      interestFreeInstallments: 10,
      monthlyInterestBps: 199,
      minInstallmentCents: 500,
    },
  });

  const categoryIds = new Map<string, string>();
  for (const [i, root] of CATEGORY_TREE.entries()) {
    const parent = await db.category.upsert({
      where: { slug: root.slug },
      update: { name: root.name, icon: root.icon, position: i, isFeatured: Boolean(root.featured), description: root.description },
      create: { slug: root.slug, name: root.name, icon: root.icon, position: i, isFeatured: Boolean(root.featured), description: root.description },
    });
    categoryIds.set(root.slug, parent.id);
    for (const [pos, a] of (root.attrs ?? []).entries()) {
      await db.categoryAttribute.upsert({
        where: { categoryId_key: { categoryId: parent.id, key: a.key } },
        update: { name: a.name, type: a.type, options: a.options ?? [], unit: a.unit ?? null, isFilterable: Boolean(a.filterable), position: pos },
        create: { categoryId: parent.id, key: a.key, name: a.name, type: a.type, options: a.options ?? [], unit: a.unit ?? null, isFilterable: Boolean(a.filterable), position: pos },
      });
    }
    for (const [j, child] of root.children.entries()) {
      const c = await db.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, icon: child.icon, parentId: parent.id, position: j },
        create: { slug: child.slug, name: child.name, icon: child.icon, parentId: parent.id, position: j },
      });
      categoryIds.set(child.slug, c.id);
    }
  }

  const brandIds = new Map<string, string>();
  for (const [slug, name, featured] of BRANDS) {
    const b = await db.brand.upsert({ where: { slug }, update: { name, isFeatured: Boolean(featured) }, create: { slug, name, isFeatured: Boolean(featured) } });
    brandIds.set(slug, b.id);
  }

  if ((await db.shippingRule.count({ where: { storeId: null } })) === 0) {
    await db.shippingRule.createMany({ data: globalShippingRules() });
  }
  return { categoryIds, brandIds };
}
