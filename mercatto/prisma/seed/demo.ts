import type { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/server/auth/password";
import { DEMO_PRODUCTS, type DemoProduct } from "./catalog-data";
import { cpfFromSeed, daysAgo, demoBanner, demoImg, ean13, hoursFromNow, rng } from "./util";

export const DEMO_PASSWORD = "Mercatto@2026";

const STORES = {
  mercatto: { name: "Mercatto", email: "admin@mercatto.dev", ownerName: "Administrador Mercatto", cep: "06455000", city: "Barueri", state: "SP", official: true, description: "Loja oficial Mercatto: estoque próprio, entrega rápida e garantia de procedência." },
  technova: { name: "TechNova Eletrônicos", email: "technova@mercatto.dev", ownerName: "Rafael Moreira", cep: "04538132", city: "São Paulo", state: "SP", description: "Especialistas em smartphones, informática e games há mais de 10 anos." },
  casaviva: { name: "Casa Viva Utilidades", email: "casaviva@mercatto.dev", ownerName: "Juliana Prado", cep: "30130010", city: "Belo Horizonte", state: "MG", description: "Tudo para a sua casa: móveis, iluminação e eletroportáteis." },
  urbanstep: { name: "Urban Step Moda", email: "urbanstep@mercatto.dev", ownerName: "Bruno Tavares", cep: "20040002", city: "Rio de Janeiro", state: "RJ", description: "Tênis, roupas e acessórios com estilo urbano." },
  bellapele: { name: "Bella Pele Cosméticos", email: "bellapele@mercatto.dev", ownerName: "Camila Rocha", cep: "80010000", city: "Curitiba", state: "PR", description: "Perfumaria e skincare com produtos originais." },
  garagempro: { name: "Garagem Pro Ferramentas", email: "garagempro@mercatto.dev", ownerName: "Marcos Lima", cep: "90010150", city: "Porto Alegre", state: "RS", description: "Ferramentas, automotivo e esportes." },
} as const;

const CUSTOMER_NAMES = [
  "Cliente Demonstração", "Ana Souza", "Carlos Pereira", "Fernanda Lima", "Lucas Oliveira", "Mariana Costa", "Pedro Santos", "Beatriz Almeida",
  "Gabriel Rodrigues", "Juliana Ferreira", "Rafael Gomes", "Larissa Martins", "Thiago Barbosa", "Camila Ribeiro", "Diego Carvalho", "Patrícia Araújo",
  "Rodrigo Mendes", "Aline Cardoso", "Felipe Rocha", "Vanessa Teixeira", "Eduardo Nunes", "Renata Moura", "Gustavo Pinto", "Tatiane Freitas",
];

const ADDRESSES = [
  { cep: "01310100", street: "Avenida Paulista", district: "Bela Vista", city: "São Paulo", state: "SP" },
  { cep: "22041001", street: "Avenida Nossa Senhora de Copacabana", district: "Copacabana", city: "Rio de Janeiro", state: "RJ" },
  { cep: "30140071", street: "Avenida Afonso Pena", district: "Centro", city: "Belo Horizonte", state: "MG" },
  { cep: "40015970", street: "Rua Chile", district: "Centro", city: "Salvador", state: "BA" },
  { cep: "80020310", street: "Rua XV de Novembro", district: "Centro", city: "Curitiba", state: "PR" },
  { cep: "60160230", street: "Avenida Beira Mar", district: "Meireles", city: "Fortaleza", state: "CE" },
  { cep: "70040010", street: "Esplanada dos Ministérios", district: "Zona Cívico-Administrativa", city: "Brasília", state: "DF" },
  { cep: "90010150", street: "Rua dos Andradas", district: "Centro Histórico", city: "Porto Alegre", state: "RS" },
];

const REVIEW_TEXTS: Record<number, [string, string][]> = {
  5: [["Excelente!", "Chegou antes do prazo e muito bem embalado. Produto exatamente como no anúncio."], ["Recomendo", "Qualidade ótima pelo preço. Já é a segunda vez que compro."], ["Superou as expectativas", "Acabamento impecável e funcionando perfeitamente."], ["Muito bom", "Entrega rápida e o vendedor respondeu todas as dúvidas."]],
  4: [["Bom produto", "Atende bem, só achei a embalagem simples."], ["Gostei", "Bom custo-benefício. Demorou um dia a mais para chegar."], ["Vale a pena", "Funciona bem, mas o manual poderia ser mais completo."]],
  3: [["Razoável", "Cumpre o que promete, mas esperava um pouco mais de qualidade."], ["Ok", "Produto mediano para o preço."]],
  2: [["Deixou a desejar", "A cor é diferente da foto e o acabamento não é dos melhores."]],
  1: [["Não gostei", "Veio com um defeito e precisei pedir troca. O atendimento resolveu."]],
};

const QUESTIONS: [string, string | null][] = [
  ["Serve para uso diário? É resistente?", "Olá! Sim, é indicado para uso diário e tem garantia do fabricante. Obrigado pela pergunta!"],
  ["Qual o prazo de entrega para São Paulo capital?", "Olá! Para a capital o prazo médio é de 2 a 4 dias úteis após a confirmação do pagamento."],
  ["Acompanha nota fiscal?", "Sim, todos os pedidos acompanham nota fiscal."],
  ["Tem garantia? Quanto tempo?", "Olá! A garantia está informada na ficha técnica do anúncio."],
  ["É original?", "Sim, produto 100% original com procedência."],
  ["Vocês enviam para o Nordeste?", null],
  ["Aceita parcelamento sem juros?", "Sim! Até 10x sem juros no cartão."],
];

function cartesian(options: Record<string, string[]>): Record<string, string>[] {
  return Object.entries(options).reduce<Record<string, string>[]>(
    (acc, [name, values]) => acc.flatMap((combo) => values.map((v) => ({ ...combo, [name]: v }))),
    [{}],
  );
}

function stockFor(profile: DemoProduct["stock"], r: ReturnType<typeof rng>, index: number) {
  switch (profile) {
    case "zero":
      return 0;
    case "low":
      return r.int(1, 3);
    case "mixed":
      return index % 3 === 0 ? 0 : r.int(2, 12);
    default:
      return r.int(8, 60);
  }
}

function buildDescription(p: DemoProduct) {
  const specLines = p.specs.slice(0, 4).map(([k, v]) => `• ${k}: ${v}`).join("\n");
  return `${p.about}\n\nPrincipais características:\n${specLines}\n\nProduto ${p.condition === "REFURBISHED" ? "recondicionado e testado" : p.condition === "USED" ? "usado em bom estado" : "novo, lacrado"}, com nota fiscal${p.warranty ? ` e garantia de ${p.warranty} ${p.warranty === 1 ? "mês" : "meses"}` : ""}. Imagens meramente ilustrativas (dados de demonstração).`;
}

export async function seedDemo(db: PrismaClient, ref: { categoryIds: Map<string, string>; brandIds: Map<string, string> }) {
  const r = rng(20261004);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // ---------------------------------------------------------------- Usuários e lojas
  const storeIds = new Map<string, string>();
  for (const [key, s] of Object.entries(STORES)) {
    const role = key === "mercatto" ? "ADMIN" : "SELLER";
    const owner = await db.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, name: s.ownerName, passwordHash, role, isDemo: true, emailVerifiedAt: new Date(), cpf: cpfFromSeed(500 + storeIds.size), phone: "11988887777" },
    });
    const store = await db.store.upsert({
      where: { ownerId: owner.id },
      update: {},
      create: {
        ownerId: owner.id, name: s.name, slug: key === "mercatto" ? "mercatto" : key, description: s.description, isOfficial: "official" in s && s.official,
        status: "ACTIVE", originCep: s.cep, originCity: s.city, originState: s.state, contactEmail: s.email, isDemo: true, document: "11222333000181",
        createdAt: key === "mercatto" ? daysAgo(900) : daysAgo(r.int(120, 1400)),
      },
    });
    storeIds.set(key, store.id);
  }
  // Loja aguardando aprovação.
  const pendingOwner = await db.user.upsert({ where: { email: "novaloja@mercatto.dev" }, update: {}, create: { email: "novaloja@mercatto.dev", name: "Sofia Andrade", passwordHash, role: "SELLER", isDemo: true } });
  await db.store.upsert({ where: { ownerId: pendingOwner.id }, update: {}, create: { ownerId: pendingOwner.id, name: "Nova Loja Floripa", slug: "nova-loja-floripa", status: "PENDING", originCep: "88010000", originCity: "Florianópolis", originState: "SC", isDemo: true, description: "Loja aguardando aprovação." } });
  await db.user.upsert({ where: { email: "suporte@mercatto.dev" }, update: {}, create: { email: "suporte@mercatto.dev", name: "Equipe de Suporte", passwordHash, role: "SUPPORT", isDemo: true, emailVerifiedAt: new Date() } });
  // Retirada no CD da loja oficial (mesmo estado).
  const officialId = storeIds.get("mercatto")!;
  if ((await db.shippingRule.count({ where: { storeId: officialId } })) === 0) {
    const { globalShippingRules } = await import("./reference");
    await db.shippingRule.createMany({ data: [...globalShippingRules().map((g) => ({ ...g, storeId: officialId })), { storeId: officialId, name: "Retirada no CD Mercatto (Barueri)", regionCode: "PICKUP", maxWeightGrams: 200000, priceCents: 0, minDays: 1, maxDays: 2 }] });
  }

  const customers: { id: string; name: string }[] = [];
  for (const [i, name] of CUSTOMER_NAMES.entries()) {
    const email = i === 0 ? "cliente@mercatto.dev" : `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".")}@mercatto.dev`;
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash, role: "CUSTOMER", isDemo: true, emailVerifiedAt: new Date(), cpf: cpfFromSeed(i), phone: `1199${String(1000000 + i).slice(-7)}`, createdAt: daysAgo(r.int(30, 700)) },
    });
    if ((await db.address.count({ where: { userId: user.id } })) === 0) {
      const a = ADDRESSES[i % ADDRESSES.length]!;
      await db.address.create({ data: { userId: user.id, label: "Casa", recipientName: name, phone: user.phone, number: String(100 + i * 7), isDefault: true, ...a } });
    }
    customers.push({ id: user.id, name });
  }

  // ---------------------------------------------------------------- Produtos
  const productRecords: { id: string; slug: string; storeKey: string; variants: { id: string; priceCents: number; name: string; sku: string }[]; images: string[]; p: DemoProduct }[] = [];
  for (const [index, p] of DEMO_PRODUCTS.entries()) {
    const categoryId = ref.categoryIds.get(p.cat);
    if (!categoryId) throw new Error(`Categoria inexistente no seed: ${p.cat}`);
    const storeId = storeIds.get(p.store)!;
    const skuBase = `MRC-${String(index + 1).padStart(4, "0")}`;
    const data = {
      storeId, categoryId, brandId: p.brand ? (ref.brandIds.get(p.brand) ?? null) : null, name: p.name, shortDescription: p.about.split(". ")[0]!.slice(0, 280),
      description: buildDescription(p), condition: p.condition ?? "NEW", status: p.status ?? "ACTIVE", sku: skuBase, gtin: ean13(index + 1), tags: p.tags ?? [],
      warrantyMonths: p.warranty ?? null, warrantyText: p.warranty ? `${p.warranty} meses de garantia contra defeitos de fabricação.` : null, includedItems: p.included ?? [],
      specifications: [{ group: "Especificações", items: p.specs.map(([name, value]) => ({ name, value })) }],
      weightGrams: p.weight, heightCm: p.dims[0], widthCm: p.dims[1], lengthCm: p.dims[2], freeShipping: Boolean(p.freeShipping), isFeatured: Boolean(p.featured), isDemo: true,
      publishedAt: p.status ? null : daysAgo(r.int(1, 200)),
    } as const;
    const product = await db.product.upsert({ where: { slug: p.slug }, update: { ...data, specifications: data.specifications }, create: { slug: p.slug, ...data } });

    // Imagens (recriadas a cada execução — dados demo).
    await db.productVariant.updateMany({ where: { productId: product.id }, data: { imageId: null } });
    await db.productImage.deleteMany({ where: { productId: product.id } });
    const colorEntries = p.colors ? Object.entries(p.colors) : [];
    const imageUrls = colorEntries.length
      ? [demoImg(p.kind, colorEntries[0]![1], 1), demoImg(p.kind, colorEntries[0]![1], 2), demoImg(p.kind, colorEntries[0]![1], 3), ...colorEntries.slice(1).map(([, c]) => demoImg(p.kind, c, 1))]
      : [demoImg(p.kind, p.color ?? "black", 1), demoImg(p.kind, p.color ?? "black", 2), demoImg(p.kind, p.color ?? "black", 3)];
    const images: { id: string }[] = [];
    for (const [position, url] of imageUrls.entries()) {
      images.push(await db.productImage.create({ data: { productId: product.id, url, alt: `${p.name} — imagem ${position + 1}`, position, width: 800, height: 800 } }));
    }
    const imageByColor = new Map<string, string>();
    colorEntries.forEach(([label], i) => imageByColor.set(label, i === 0 ? images[0]!.id : images[2 + i]!.id));

    await db.productOption.deleteMany({ where: { productId: product.id } });
    const options = p.options ?? {};
    for (const [position, [name, values]] of Object.entries(options).entries()) {
      await db.productOption.create({ data: { productId: product.id, name, values, position } });
    }
    const combos = Object.keys(options).length ? cartesian(options) : [{}];
    const variants = [];
    for (const [vi, combo] of combos.entries()) {
      const extra = Object.values(combo).reduce((s, v) => s + (p.step?.[v] ?? 0), 0);
      const price = p.price + extra;
      const sku = `${skuBase}-${String(vi + 1).padStart(2, "0")}`;
      const stock = stockFor(p.stock, r, vi);
      const name = Object.values(combo).join(" · ") || "Padrão";
      const v = await db.productVariant.upsert({
        where: { sku },
        update: { name, optionValues: combo, priceCents: price, compareAtPriceCents: p.compare ? p.compare + extra : null, imageId: combo.Cor ? (imageByColor.get(combo.Cor) ?? null) : null, position: vi },
        create: { productId: product.id, sku, name, optionValues: combo, priceCents: price, compareAtPriceCents: p.compare ? p.compare + extra : null, costCents: Math.round(price * 0.62), stock, minStock: 3, imageId: combo.Cor ? (imageByColor.get(combo.Cor) ?? null) : null, position: vi },
      });
      if (!(await db.inventoryMovement.findFirst({ where: { variantId: v.id } }))) {
        await db.inventoryMovement.create({ data: { variantId: v.id, type: "IN", quantity: v.stock, balanceAfter: v.stock, reason: "Estoque inicial (DEMO)" } });
      }
      variants.push({ id: v.id, priceCents: price, name, sku });
    }
    // Atributos de categoria (herdados do pai).
    const cat = await db.category.findUnique({ where: { id: categoryId }, select: { parentId: true } });
    const attrDefs = await db.categoryAttribute.findMany({ where: { categoryId: { in: [categoryId, cat?.parentId ?? ""] } } });
    await db.productAttributeValue.deleteMany({ where: { productId: product.id } });
    for (const [key, value] of Object.entries(p.attrs ?? {})) {
      const def = attrDefs.find((d) => d.key === key);
      if (def) await db.productAttributeValue.create({ data: { productId: product.id, attributeId: def.id, value } });
    }
    productRecords.push({ id: product.id, slug: p.slug, storeKey: p.store, variants, images: imageUrls, p });
  }

  const bySlug = new Map(productRecords.map((x) => [x.slug, x]));
  const ids = (...slugs: string[]) => slugs.map((s) => bySlug.get(s)?.id).filter((x): x is string => Boolean(x));

  // ---------------------------------------------------------------- Campanha, promoções, cupons, banners
  const campaign = await db.campaign.upsert({
    where: { slug: "semana-mercatto" },
    update: { startsAt: daysAgo(2), endsAt: hoursFromNow(24 * 5), isActive: true },
    create: { slug: "semana-mercatto", name: "Semana Mercatto", description: "Descontos oficiais em tecnologia, casa e muito mais. Só até domingo!", bannerUrl: demoBanner("official"), themeColor: "#0b5c4d", startsAt: daysAgo(2), endsAt: hoursFromNow(24 * 5) },
  });
  if ((await db.promotion.count({ where: { name: { startsWith: "[DEMO]" } } })) === 0) {
    const promo = (data: Parameters<typeof db.promotion.create>[0]["data"]) => db.promotion.create({ data });
    await promo({ name: "[DEMO] Relâmpago Tecnologia", type: "PERCENT_OFF", value: 18, isFlash: true, status: "ACTIVE", storeId: officialId, campaignId: campaign.id, startsAt: daysAgo(0, 2), endsAt: hoursFromNow(5), stockLimit: 40, soldCount: 17, perCustomerLimit: 2, items: { create: ids("apple-airpods-pro-2", "jbl-flip-6", "logitech-mx-master-3s", "xiaomi-smart-band-9").map((productId) => ({ productId })) } });
    await promo({ name: "[DEMO] Relâmpago Casa", type: "PERCENT_OFF", value: 25, isFlash: true, status: "ACTIVE", storeId: officialId, campaignId: campaign.id, startsAt: daysAgo(0, 1), endsAt: hoursFromNow(11), stockLimit: 60, soldCount: 22, perCustomerLimit: 3, items: { create: ids("mondial-air-fryer-4l", "tramontina-jogo-panelas", "cadeira-escritorio-ergonomica", "electrolux-micro-ondas-31l").map((productId) => ({ productId })) } });
    await promo({ name: "[DEMO] Relâmpago Games", type: "AMOUNT_OFF", value: 30000, isFlash: true, status: "ACTIVE", storeId: officialId, campaignId: campaign.id, startsAt: daysAgo(0, 3), endsAt: hoursFromNow(20), stockLimit: 25, soldCount: 9, perCustomerLimit: 1, items: { create: ids("playstation-5-slim").map((productId) => ({ productId })) } });
    await promo({ name: "[DEMO] Semana Mercatto — Smartphones", type: "PERCENT_OFF", value: 10, status: "ACTIVE", storeId: officialId, campaignId: campaign.id, startsAt: daysAgo(2), endsAt: hoursFromNow(24 * 5), items: { create: ids("apple-iphone-16", "samsung-galaxy-s24", "motorola-moto-g85").map((productId) => ({ productId })) } });
    await promo({ name: "[DEMO] Próxima relâmpago (agendada)", type: "PERCENT_OFF", value: 30, isFlash: true, status: "SCHEDULED", storeId: officialId, startsAt: hoursFromNow(26), endsAt: hoursFromNow(32), stockLimit: 30, items: { create: ids("samsung-smart-tv-55-crystal").map((productId) => ({ productId })) } });
    await promo({ name: "[DEMO] Promoção encerrada", type: "PERCENT_OFF", value: 15, status: "EXPIRED", storeId: officialId, startsAt: daysAgo(20), endsAt: daysAgo(10), items: { create: ids("apple-macbook-air-m3").map((productId) => ({ productId })) } });
    await promo({ name: "[DEMO] TechNova — Notebooks", type: "PERCENT_OFF", value: 8, status: "ACTIVE", storeId: storeIds.get("technova")!, startsAt: daysAgo(3), endsAt: hoursFromNow(24 * 10), items: { create: ids("lenovo-ideapad-slim-3", "acer-nitro-v15").map((productId) => ({ productId })) } });
    await promo({ name: "[DEMO] Urban Step — Tênis", type: "FIXED_PRICE", value: 34990, status: "ACTIVE", storeId: storeIds.get("urbanstep")!, startsAt: daysAgo(1), endsAt: hoursFromNow(24 * 7), items: { create: ids("nike-revolution-7").map((productId) => ({ productId })) } });
    await promo({ name: "[DEMO] Esportes 10% OFF", type: "PERCENT_OFF", value: 10, status: "ACTIVE", storeId: storeIds.get("garagempro")!, categoryIds: [ref.categoryIds.get("esportes")!], startsAt: daysAgo(1), endsAt: hoursFromNow(24 * 6), items: { create: [] } });
  }

  const coupons = [
    { code: "BEMVINDO10", description: "10% na primeira compra (até R$ 100)", type: "PERCENT" as const, value: 10, maxDiscountCents: 10000, firstPurchaseOnly: true, isPublic: true, usageLimitPerUser: 1 },
    { code: "FRETEGRATIS", description: "Frete grátis acima de R$ 99", type: "FREE_SHIPPING" as const, value: 0, minOrderCents: 9900, isPublic: true, usageLimitPerUser: 3 },
    { code: "MERCATTO50", description: "R$ 50 OFF acima de R$ 500", type: "FIXED" as const, value: 5000, minOrderCents: 50000, usageLimit: 100, isPublic: true, usageLimitPerUser: 1 },
    { code: "EXPIRADO10", description: "Cupom expirado (demonstração)", type: "PERCENT" as const, value: 10, endsAt: daysAgo(5), usageLimitPerUser: 1 },
    { code: "TECHNOVA15", description: "15% em produtos da TechNova", type: "PERCENT" as const, value: 15, maxDiscountCents: 30000, storeId: storeIds.get("technova")!, isPublic: true, usageLimitPerUser: 1 },
  ];
  for (const c of coupons) await db.coupon.upsert({ where: { code: c.code }, update: {}, create: c });

  if ((await db.banner.count()) === 0) {
    await db.banner.createMany({
      data: [
        { title: "Semana Mercatto", subtitle: "Até 30% OFF em tecnologia com entrega rápida e frete grátis acima de R$ 199.", eyebrow: "Ofertas oficiais", ctaLabel: "Ver ofertas", link: "/campanha/semana-mercatto", imageUrl: demoBanner("official"), theme: "brand", placement: "HOME_HERO", position: 0 },
        { title: "Ofertas relâmpago", subtitle: "Preços que acabam em horas. Corra antes que esgote!", eyebrow: "Só hoje", ctaLabel: "Aproveitar", link: "/ofertas", imageUrl: demoBanner("flash"), theme: "sun", placement: "HOME_HERO", position: 1 },
        { title: "Smartphones com até 10x sem juros", subtitle: "iPhone, Galaxy, Motorola e Xiaomi com garantia.", eyebrow: "Celulares", ctaLabel: "Comprar agora", link: "/categoria/celulares", imageUrl: demoBanner("tech"), theme: "ink", placement: "HOME_HERO", position: 2 },
        { title: "Sua casa mais prática", subtitle: "Air fryers, panelas e eletroportáteis selecionados.", eyebrow: "Casa e cozinha", ctaLabel: "Explorar", link: "/categoria/eletrodomesticos", imageUrl: demoBanner("home"), theme: "light", placement: "HOME_HERO", position: 3 },
        { title: "Games", subtitle: "Consoles e controles com o melhor preço.", ctaLabel: "Ver games", link: "/categoria/games", imageUrl: demoBanner("games"), theme: "ink", placement: "HOME_MID", position: 0 },
        { title: "Moda e esportes", subtitle: "Tênis e acessórios para todo dia.", ctaLabel: "Ver moda", link: "/categoria/moda", imageUrl: demoBanner("fashion"), theme: "light", placement: "HOME_MID", position: 1 },
        { title: "Frete grátis nas compras oficiais acima de R$ 199", ctaLabel: "Saiba mais", link: "/oficial", theme: "brand", placement: "HOME_STRIP", position: 0 },
      ],
    });
  }

  // ---------------------------------------------------------------- Histórico (pedidos, avaliações, perguntas)
  const hasHistory = (await db.order.count({ where: { user: { isDemo: true } } })) > 0;
  if (!hasHistory) await seedHistory(db, r, customers, productRecords.filter((x) => !x.p.status), storeIds);

  // Termos populares (alimentam o autocomplete).
  for (const [term, count] of [["iphone", 320], ["air fryer", 210], ["smart tv", 180], ["notebook", 160], ["fone bluetooth", 150], ["tenis", 140], ["playstation 5", 130], ["geladeira", 90], ["jbl", 85], ["galaxy", 80]] as const) {
    await db.searchTerm.upsert({ where: { term }, update: {}, create: { term, count } });
  }

  // Favoritos e notificações do cliente demo.
  const demoCustomer = customers[0]!;
  for (const productId of ids("apple-iphone-16", "jbl-flip-6", "playstation-5-slim", "cadeira-escritorio-ergonomica")) {
    await db.wishlistItem.upsert({ where: { userId_productId: { userId: demoCustomer.id, productId } }, update: {}, create: { userId: demoCustomer.id, productId } });
  }
  if ((await db.notification.count({ where: { userId: demoCustomer.id } })) === 0) {
    await db.notification.createMany({
      data: [
        { userId: demoCustomer.id, type: "COUPON_AVAILABLE", title: "Cupom para você", body: "Use BEMVINDO10 e ganhe 10% na primeira compra.", link: "/minha-conta/cupons" },
        { userId: demoCustomer.id, type: "PRICE_DROP", title: "Baixou o preço!", body: "Um produto dos seus favoritos está mais barato.", link: "/minha-conta/favoritos" },
      ],
    });
  }
  return { storeIds, products: productRecords.length, customers: customers.length };
}

async function seedHistory(
  db: PrismaClient,
  r: ReturnType<typeof rng>,
  customers: { id: string; name: string }[],
  products: { id: string; storeKey: string; variants: { id: string; priceCents: number; name: string; sku: string }[]; images: string[]; p: DemoProduct }[],
  storeIds: Map<string, string>,
) {
  const statuses = ["DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "SHIPPED", "PAID", "PROCESSING", "CANCELLED"] as const;
  const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  const reviewed = new Set<string>();
  let n = 0;
  for (let i = 0; i < 160; i++) {
    const customer = customers[i % customers.length]!;
    const product = products[r.int(0, products.length - 1)]!;
    const variant = product.variants[r.int(0, product.variants.length - 1)]!;
    const qty = r.chance(0.85) ? 1 : 2;
    const status = statuses[r.int(0, statuses.length - 1)]!;
    const created = daysAgo(r.int(1, 90), r.int(0, 23));
    const shipping = product.p.freeShipping ? 0 : r.pick([1490, 1990, 2690, 3490]);
    const subtotal = variant.priceCents * qty;
    const total = subtotal + shipping;
    const number = `MRC-${Array.from({ length: 4 }, () => alphabet[r.int(0, alphabet.length - 1)]).join("")}-${Array.from({ length: 4 }, () => alphabet[r.int(0, alphabet.length - 1)]).join("")}`;
    const address = await db.address.findFirst({ where: { userId: customer.id } });
    const snapshot = address ? { recipientName: address.recipientName, cep: address.cep, street: address.street, number: address.number, complement: address.complement, district: address.district, city: address.city, state: address.state } : {};
    const paid = status !== "CANCELLED";
    const checkout = await db.checkout.create({
      data: {
        userId: customer.id, idempotencyKey: `demo-${i}-${number}`, status: paid ? "PAID" : "CANCELLED", subtotalCents: subtotal, shippingCents: shipping, totalCents: total,
        paymentMethod: r.chance(0.55) ? "PIX" : "CREDIT_CARD", installments: 1, shippingAddress: snapshot, customerSnapshot: { name: customer.name }, expiresAt: new Date(created.getTime() + 30 * 60_000), createdAt: created,
      },
    });
    await db.payment.create({ data: { checkoutId: checkout.id, provider: "dev", providerPaymentId: `dev_demo_${checkout.id}`, idempotencyKey: `demo-pay-${checkout.id}`, method: checkout.paymentMethod, status: paid ? "PAID" : "EXPIRED", amountCents: total, isSandbox: true, paidAt: paid ? created : null, createdAt: created } });
    const timeline: { status: string; at: Date }[] = [{ status: "PENDING_PAYMENT", at: created }];
    if (paid) timeline.push({ status: "PAID", at: new Date(created.getTime() + 10 * 60_000) });
    if (["PROCESSING", "SHIPPED", "DELIVERED"].includes(status)) timeline.push({ status: "PROCESSING", at: new Date(created.getTime() + 20 * 3600_000) });
    if (["SHIPPED", "DELIVERED"].includes(status)) timeline.push({ status: "SHIPPED", at: new Date(created.getTime() + 36 * 3600_000) });
    if (status === "DELIVERED") timeline.push({ status: "DELIVERED", at: new Date(Math.min(Date.now() - 3600_000, created.getTime() + 5 * 24 * 3600_000)) });
    if (status === "CANCELLED") timeline.push({ status: "CANCELLED", at: new Date(created.getTime() + 31 * 60_000) });
    const order = await db.order.create({
      data: {
        number, checkoutId: checkout.id, userId: customer.id, storeId: storeIds.get(product.storeKey)!, status, subtotalCents: subtotal, shippingCents: shipping, totalCents: total, shippingAddress: snapshot,
        shippingService: "Padrão", shippingEtaDays: 5, createdAt: created, paidAt: paid ? timeline[1]!.at : null, shippedAt: timeline.find((t) => t.status === "SHIPPED")?.at ?? null,
        deliveredAt: timeline.find((t) => t.status === "DELIVERED")?.at ?? null, cancelledAt: status === "CANCELLED" ? timeline.at(-1)!.at : null, cancelReason: status === "CANCELLED" ? "Pagamento não realizado no prazo" : null,
        events: { create: timeline.map((t) => ({ status: t.status as never, createdAt: t.at, note: t.status === "PAID" ? "Pagamento aprovado (DEMO)" : null })) },
        shipment: { create: { provider: "table", service: "Padrão", carrier: "Transportadora parceira", priceCents: shipping, estimatedDays: 5, status: status === "DELIVERED" ? "DELIVERED" : status === "SHIPPED" ? "SHIPPED" : status === "CANCELLED" ? "CANCELLED" : "PENDING", trackingCode: ["SHIPPED", "DELIVERED"].includes(status) ? `BR${r.int(100000000, 999999999)}MC` : null } },
      },
    });
    const item = await db.orderItem.create({
      data: { orderId: order.id, productId: product.id, variantId: variant.id, productName: product.p.name, variantName: variant.name, sku: variant.sku, imageUrl: product.images[0] ?? null, unitPriceCents: variant.priceCents, originalPriceCents: variant.priceCents, quantity: qty, totalCents: subtotal, createdAt: created },
    });
    if (paid) {
      await db.product.update({ where: { id: product.id }, data: { salesCount: { increment: qty } } });
      await db.store.update({ where: { id: storeIds.get(product.storeKey)! }, data: { salesCount: { increment: 1 } } });
    } else {
      await db.store.update({ where: { id: storeIds.get(product.storeKey)! }, data: { cancelledCount: { increment: 1 } } });
    }
    // Avaliação verificada (DEMO) para itens entregues.
    const key = `${customer.id}:${product.id}`;
    if (status === "DELIVERED" && !reviewed.has(key) && r.chance(0.75)) {
      reviewed.add(key);
      const rating = r.pick([5, 5, 5, 5, 4, 4, 4, 3, 2, 1]);
      const [title, comment] = r.pick(REVIEW_TEXTS[rating]!);
      await db.review.create({ data: { productId: product.id, userId: customer.id, orderItemId: item.id, rating, title, comment, isVerifiedPurchase: true, isDemo: true, createdAt: new Date((order.deliveredAt ?? created).getTime() + 24 * 3600_000) } });
      await db.orderItem.update({ where: { id: item.id }, data: { reviewed: true } });
    }
    n++;
  }

  // Perguntas (DEMO), algumas sem resposta.
  for (const [i, product] of products.slice(0, 30).entries()) {
    const [body, answer] = QUESTIONS[i % QUESTIONS.length]!;
    const asker = customers[(i * 5 + 3) % customers.length]!;
    const q = await db.question.create({ data: { productId: product.id, userId: asker.id, body, isDemo: true, createdAt: daysAgo(r.int(1, 40)) } });
    if (answer) {
      const store = await db.store.findUniqueOrThrow({ where: { id: storeIds.get(product.storeKey)! }, select: { id: true, ownerId: true } });
      await db.answer.create({ data: { questionId: q.id, storeId: store.id, userId: store.ownerId, body: answer, createdAt: new Date(q.createdAt.getTime() + 3 * 3600_000) } });
    }
  }

  // Estatísticas diárias (visitas/adições ao carrinho) dos últimos 30 dias.
  for (const product of products) {
    const rows = [];
    for (let d = 0; d < 30; d++) {
      const day = new Date(daysAgo(d).toISOString().slice(0, 10));
      const views = r.int(5, product.p.featured ? 260 : 90);
      rows.push({ productId: product.id, day, views, addToCart: Math.round(views * (0.04 + r.next() * 0.06)), purchases: r.chance(0.3) ? r.int(1, 3) : 0 });
    }
    await db.productDailyStat.createMany({ data: rows, skipDuplicates: true });
    await db.product.update({ where: { id: product.id }, data: { viewCount: rows.reduce((s, x) => s + x.views, 0) } });
  }
  return n;
}
