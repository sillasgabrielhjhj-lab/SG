import { PrismaPg } from "@prisma/adapter-pg";
import { fakerPT_BR as faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import { Role, CouponType } from "../src/generated/prisma/enums";

// Script de seed roda fora do pipeline do Next.js (via tsx), então não
// pode importar módulos marcados com "server-only" — por isso o hash de
// senha é feito direto com bcryptjs aqui, sem passar por src/lib/auth.
const hashPassword = (plain: string) => bcrypt.hash(plain, 12);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

faker.seed(2026);

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function placeholderUrl(seedKey: string) {
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  return `/placeholders/ph-${hash % 48}.svg`;
}

// ---------------------------------------------------------------------------
// Categorias e subcategorias
// ---------------------------------------------------------------------------

const CATEGORY_TREE: { name: string; children?: string[] }[] = [
  { name: "Eletrônicos", children: ["TVs e Vídeo", "Áudio", "Câmeras e Drones"] },
  { name: "Celulares", children: ["Smartphones", "Acessórios para Celular"] },
  { name: "Informática", children: ["Notebooks", "Periféricos", "Armazenamento"] },
  { name: "Casa", children: ["Cozinha", "Móveis", "Decoração"] },
  { name: "Moda", children: ["Moda Masculina", "Moda Feminina", "Calçados"] },
  { name: "Beleza", children: ["Perfumaria", "Cuidados com a Pele"] },
  { name: "Esportes", children: ["Fitness", "Ciclismo"] },
  { name: "Automóveis", children: ["Acessórios Automotivos", "Som Automotivo"] },
  { name: "Ferramentas", children: ["Ferramentas Elétricas", "Ferramentas Manuais"] },
  { name: "Games", children: ["Acessórios para Console", "Cadeiras Gamer"] },
  { name: "Livros", children: ["Ficção", "Não Ficção"] },
];

// Produtos por categoria-folha: [nome base, faixa de preço em centavos]
const PRODUCT_POOL: Record<string, { name: string; min: number; max: number }[]> = {
  "TVs e Vídeo": [
    { name: "Smart TV 50'' 4K UHD", min: 189990, max: 259990 },
    { name: "Smart TV 43'' Full HD", min: 139990, max: 189990 },
    { name: "Soundbar 2.1 com Subwoofer", min: 49990, max: 89990 },
    { name: "Chromecast para Streaming", min: 24990, max: 34990 },
    { name: "Suporte de Parede para TV", min: 7990, max: 15990 },
    { name: "Projetor Portátil Full HD", min: 29990, max: 49990 },
  ],
  "Áudio": [
    { name: "Fone de Ouvido Bluetooth Over-Ear", min: 18990, max: 34990 },
    { name: "Caixa de Som Portátil à Prova D'água", min: 14990, max: 29990 },
    { name: "Fone de Ouvido Intra-auricular TWS", min: 9990, max: 19990 },
    { name: "Microfone USB para Streaming", min: 22990, max: 39990 },
    { name: "Caixa de Som Bluetooth Mini", min: 6990, max: 12990 },
  ],
  "Câmeras e Drones": [
    { name: "Câmera de Ação 4K", min: 59990, max: 99990 },
    { name: "Drone com Câmera HD", min: 129990, max: 249990 },
    { name: "Webcam Full HD com Microfone", min: 17990, max: 29990 },
  ],
  "Smartphones": [
    { name: "Smartphone 128GB Tela 6.5''", min: 129990, max: 249990 },
    { name: "Smartphone 256GB Câmera Tripla", min: 189990, max: 349990 },
    { name: "Smartphone Entrada 64GB", min: 69990, max: 109990 },
    { name: "Smartphone Dobrável Premium", min: 349990, max: 599990 },
  ],
  "Acessórios para Celular": [
    { name: "Capa Antichoque para Smartphone", min: 2990, max: 5990 },
    { name: "Película de Vidro Temperado", min: 1990, max: 3990 },
    { name: "Carregador Rápido 65W", min: 7990, max: 12990 },
    { name: "Power Bank 20000mAh", min: 12990, max: 22990 },
  ],
  "Notebooks": [
    { name: "Notebook i5 8GB 256GB SSD", min: 299990, max: 429990 },
    { name: "Notebook i7 16GB 512GB SSD", min: 449990, max: 649990 },
    { name: "Notebook Básico 4GB 128GB", min: 199990, max: 279990 },
    { name: "Notebook Gamer i7 16GB RTX", min: 549990, max: 799990 },
  ],
  "Periféricos": [
    { name: "Teclado Mecânico RGB", min: 19990, max: 34990 },
    { name: "Mouse Gamer sem Fio", min: 12990, max: 24990 },
    { name: "Monitor 27'' Full HD 75Hz", min: 89990, max: 129990 },
    { name: "Headset Gamer Surround 7.1", min: 24990, max: 39990 },
    { name: "Webcam 4K para Streaming", min: 29990, max: 49990 },
  ],
  "Armazenamento": [
    { name: "SSD Externo 1TB USB-C", min: 39990, max: 59990 },
    { name: "Pen Drive 128GB USB 3.0", min: 4990, max: 8990 },
    { name: "HD Externo 2TB", min: 34990, max: 49990 },
  ],
  "Cozinha": [
    { name: "Air Fryer Digital 5L", min: 24990, max: 39990 },
    { name: "Cafeteira Elétrica Programável", min: 15990, max: 27990 },
    { name: "Jogo de Panelas Antiaderente 5 Peças", min: 19990, max: 32990 },
    { name: "Liquidificador 3 Velocidades", min: 11990, max: 19990 },
    { name: "Sanduicheira Grill Elétrica", min: 9990, max: 16990 },
  ],
  "Móveis": [
    { name: "Cadeira de Escritório Ergonômica", min: 49990, max: 89990 },
    { name: "Mesa de Centro Madeira", min: 29990, max: 54990 },
    { name: "Estante Organizadora 5 Prateleiras", min: 24990, max: 44990 },
    { name: "Poltrona Reclinável", min: 39990, max: 69990 },
  ],
  "Decoração": [
    { name: "Luminária de Mesa LED", min: 7990, max: 14990 },
    { name: "Quadro Decorativo Trio", min: 9990, max: 17990 },
    { name: "Tapete Sala de Estar", min: 14990, max: 27990 },
    { name: "Espelho Decorativo Redondo", min: 8990, max: 16990 },
  ],
  "Moda Masculina": [
    { name: "Camiseta Básica Algodão", min: 3990, max: 6990 },
    { name: "Jaqueta Jeans Masculina", min: 15990, max: 24990 },
    { name: "Calça Jogger Masculina", min: 9990, max: 16990 },
    { name: "Bermuda Jeans Masculina", min: 6990, max: 11990 },
  ],
  "Moda Feminina": [
    { name: "Vestido Midi Casual", min: 12990, max: 21990 },
    { name: "Blusa Feminina Manga Longa", min: 6990, max: 11990 },
    { name: "Legging Fitness Feminina", min: 5990, max: 9990 },
    { name: "Saia Midi Plissada", min: 7990, max: 13990 },
  ],
  "Calçados": [
    { name: "Tênis Esportivo Runner", min: 19990, max: 34990 },
    { name: "Tênis Casual Unissex", min: 14990, max: 24990 },
    { name: "Sandália Feminina Conforto", min: 8990, max: 14990 },
    { name: "Chinelo Slide Unissex", min: 3990, max: 6990 },
  ],
  "Perfumaria": [
    { name: "Perfume Importado 100ml", min: 19990, max: 44990 },
    { name: "Kit Perfume + Hidratante", min: 14990, max: 29990 },
  ],
  "Cuidados com a Pele": [
    { name: "Kit Skincare Facial Completo", min: 12990, max: 24990 },
    { name: "Protetor Solar Facial FPS 60", min: 4990, max: 8990 },
    { name: "Secador de Cabelo Profissional", min: 15990, max: 27990 },
  ],
  "Fitness": [
    { name: "Kit Halteres Emborrachados", min: 14990, max: 27990 },
    { name: "Tapete de Yoga Antiderrapante", min: 6990, max: 12990 },
    { name: "Corda de Pular Profissional", min: 2990, max: 4990 },
    { name: "Faixa Elástica para Exercícios Kit", min: 3990, max: 6990 },
    { name: "Banco Regulável para Musculação", min: 24990, max: 39990 },
  ],
  "Ciclismo": [
    { name: "Bicicleta Aro 29 21 Marchas", min: 129990, max: 229990 },
    { name: "Capacete para Ciclismo", min: 9990, max: 17990 },
    { name: "Luz de Led para Bicicleta Kit", min: 3990, max: 6990 },
  ],
  "Acessórios Automotivos": [
    { name: "Capa para Banco Automotivo Kit", min: 19990, max: 34990 },
    { name: "Suporte Veicular para Celular", min: 3990, max: 6990 },
    { name: "Aspirador de Pó Automotivo", min: 9990, max: 16990 },
    { name: "Câmera de Ré Automotiva", min: 12990, max: 22990 },
  ],
  "Som Automotivo": [
    { name: "Kit Som Automotivo Bluetooth", min: 29990, max: 49990 },
    { name: "Alto-falante Automotivo Par", min: 19990, max: 34990 },
  ],
  "Ferramentas Elétricas": [
    { name: "Furadeira Parafusadeira 20V", min: 24990, max: 39990 },
    { name: "Serra Tico-Tico Elétrica", min: 19990, max: 32990 },
    { name: "Lixadeira Orbital Elétrica", min: 17990, max: 29990 },
    { name: "Compressor de Ar Portátil", min: 34990, max: 54990 },
  ],
  "Ferramentas Manuais": [
    { name: "Kit Chaves de Fenda e Phillips 32 Peças", min: 6990, max: 12990 },
    { name: "Jogo de Chaves Combinadas", min: 9990, max: 17990 },
    { name: "Trena a Laser 40m", min: 14990, max: 24990 },
    { name: "Alicate Universal Profissional", min: 4990, max: 8990 },
  ],
  "Acessórios para Console": [
    { name: "Controle sem Fio para Console", min: 29990, max: 44990 },
    { name: "Headset Gamer com Microfone", min: 17990, max: 29990 },
    { name: "Carregador Duplo para Controle", min: 9990, max: 15990 },
    { name: "Base de Carregamento para Console", min: 14990, max: 22990 },
  ],
  "Cadeiras Gamer": [
    { name: "Cadeira Gamer Reclinável", min: 89990, max: 149990 },
    { name: "Cadeira Gamer com Apoio de Braço", min: 69990, max: 109990 },
  ],
  "Ficção": [
    { name: "Romance Best-seller Capa Dura", min: 3990, max: 6990 },
    { name: "Box Coleção Clássicos da Literatura", min: 9990, max: 17990 },
    { name: "Livro de Fantasia Edição Especial", min: 4990, max: 8990 },
    { name: "Graphic Novel Edição Limitada", min: 5990, max: 9990 },
  ],
  "Não Ficção": [
    { name: "Livro de Receitas Ilustrado", min: 4990, max: 8990 },
    { name: "Livro de Desenvolvimento Pessoal", min: 3990, max: 6990 },
    { name: "Biografia Capa Dura", min: 5990, max: 9990 },
    { name: "Atlas Geográfico Ilustrado", min: 6990, max: 11990 },
  ],
};

const DESCRIPTION_TEMPLATES = [
  (name: string) =>
    `${name} desenvolvido com foco em qualidade e durabilidade. Ideal para o uso diário, combina bom acabamento com ótimo custo-benefício.`,
  (name: string) =>
    `Leve para casa o ${name.toLowerCase()}: um produto pensado para facilitar sua rotina, com materiais selecionados e acabamento cuidadoso.`,
  (name: string) =>
    `${name} com excelente relação custo-benefício. Testado para garantir desempenho consistente e satisfação na compra.`,
  (name: string) =>
    `Procurando praticidade? O ${name.toLowerCase()} entrega o que promete, com design moderno e fácil utilização no dia a dia.`,
];

const ATTRIBUTE_POOL = [
  ["Cor", ["Preto", "Branco", "Azul", "Cinza", "Vermelho"]],
  ["Material", ["Plástico ABS", "Alumínio", "Aço Inox", "Tecido", "Couro Sintético"]],
  ["Garantia", ["3 meses", "6 meses", "12 meses"]],
  ["Voltagem", ["Bivolt", "110V", "220V"]],
] as const;

async function main() {
  // Guarda de segurança: se já existe produto no banco (seed anterior ou
  // uso real da loja), não mexe em nada. Isso permite deixar `db:seed` no
  // comando de build de produção sem risco de apagar dados reais em
  // deploys futuros.
  const existingProductCount = await prisma.product.count();
  if (existingProductCount > 0) {
    // Ação administrativa pontual: desativa todo o catálogo de demonstração
    // de uma vez (não apaga — produtos com pedido vinculado não podem ser
    // apagados, e desativado já é suficiente pra sumir da loja). Disparado
    // só quando a variável de ambiente está explicitamente "true"; nunca
    // roda sozinho.
    if (process.env.DEACTIVATE_DEMO_PRODUCTS === "true") {
      const result = await prisma.product.updateMany({ where: { isActive: true }, data: { isActive: false } });
      console.log(`Seed: ${result.count} produto(s) de demonstração desativados (DEACTIVATE_DEMO_PRODUCTS=true).`);
      return;
    }

    console.log(
      `Seed: ${existingProductCount} produto(s) já existem no banco — pulando (nada foi alterado).`,
    );
    return;
  }

  console.log("Seed: banco vazio, populando dados de demonstração...");

  // ---- Categorias --------------------------------------------------------
  const categoryBySlug = new Map<string, string>(); // name -> id

  for (const top of CATEGORY_TREE) {
    const topSlug = slugify(top.name);
    const topCategory = await prisma.category.upsert({
      where: { slug: topSlug },
      update: {},
      create: { name: top.name, slug: topSlug, imageUrl: placeholderUrl(topSlug) },
    });
    categoryBySlug.set(top.name, topCategory.id);

    for (const childName of top.children ?? []) {
      const childSlug = slugify(childName);
      const child = await prisma.category.upsert({
        where: { slug: childSlug },
        update: {},
        create: {
          name: childName,
          slug: childSlug,
          parentId: topCategory.id,
          imageUrl: placeholderUrl(childSlug),
        },
      });
      categoryBySlug.set(childName, child.id);
    }
  }
  console.log(`  ${categoryBySlug.size} categorias/subcategorias criadas.`);

  // ---- Marcas (fictícias) -------------------------------------------------
  const BRAND_NAMES = [
    "Nova Tech", "Lumina", "Vortex", "Zenith Home", "UrbanFit", "CoreTech",
    "BrightHome", "PulseAudio", "NorthGear", "Primeline", "Solara",
    "Mavix", "Everwell", "Dynatech", "Clarion Home",
  ];
  const brandIds: string[] = [];
  for (const name of BRAND_NAMES) {
    const slug = slugify(name);
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    brandIds.push(brand.id);
  }
  console.log(`  ${brandIds.length} marcas criadas.`);

  // ---- Vendedores (20) -----------------------------------------------------
  const sellerIds: string[] = [];
  const demoPasswordHash = await hashPassword("Senha123!");

  for (let i = 0; i < 20; i++) {
    const storeName = `${faker.company.name()} Loja Oficial`;
    const slug = `${slugify(storeName)}-${i}`;
    const email = `vendedor${i}@mercatto.dev`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: faker.person.fullName(),
        email,
        passwordHash: demoPasswordHash,
        role: Role.SELLER,
        emailVerified: new Date(),
      },
    });

    const seller = await prisma.seller.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        storeName,
        slug,
        description: `${storeName} — vendedor verificado na Mercatto, com entrega rápida e atendimento dedicado.`,
        logoUrl: placeholderUrl(slug),
        isVerified: i % 4 !== 0,
        ratingAvg: Number((3.8 + Math.random() * 1.2).toFixed(1)),
        ratingCount: faker.number.int({ min: 10, max: 800 }),
      },
    });
    sellerIds.push(seller.id);
  }
  console.log(`  ${sellerIds.length} vendedores criados.`);

  // ---- Usuários demo (compradores) -----------------------------------------
  await prisma.user.upsert({
    where: { email: "admin@mercatto.dev" },
    update: {},
    create: {
      name: "Administrador Mercatto",
      email: "admin@mercatto.dev",
      passwordHash: demoPasswordHash,
      role: Role.ADMIN,
      emailVerified: new Date(),
    },
  });

  const buyerIds: string[] = [];
  for (let i = 0; i < 8; i++) {
    const email = i === 0 ? "cliente@mercatto.dev" : `cliente${i}@mercatto.dev`;
    const buyer = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: faker.person.fullName(),
        email,
        passwordHash: demoPasswordHash,
        role: Role.USER,
        emailVerified: new Date(),
      },
    });
    buyerIds.push(buyer.id);
  }
  console.log(`  1 admin + ${buyerIds.length} usuários compradores demo criados.`);
  console.log(`  Login demo: admin@mercatto.dev / cliente@mercatto.dev / vendedor0@mercatto.dev — senha: Senha123!`);

  // ---- Produtos (alvo: ~100) ----------------------------------------------
  const leafEntries = Object.entries(PRODUCT_POOL);
  let productCount = 0;
  let skuCounter = 1000;

  for (const [categoryName, pool] of leafEntries) {
    const categoryId = categoryBySlug.get(categoryName);
    if (!categoryId) continue;

    for (const item of pool) {
      const variantSuffix = faker.helpers.arrayElement(["", " Premium", " Compacto", " Pro"]);
      const name = `${item.name}${variantSuffix}`;
      const slug = `${slugify(name)}-${skuCounter}`;
      const sku = `MKT-${skuCounter}`;
      skuCounter++;

      const priceCents = faker.number.int({ min: item.min, max: item.max });
      const hasDiscount = Math.random() < 0.35;
      const compareAtPriceCents = hasDiscount
        ? Math.round(priceCents * (1 + 0.15 + Math.random() * 0.25))
        : null;

      const sellerId = faker.helpers.arrayElement(sellerIds);
      const brandId = Math.random() < 0.8 ? faker.helpers.arrayElement(brandIds) : null;
      const description = faker.helpers.arrayElement(DESCRIPTION_TEMPLATES)(name);

      const ratingCount = faker.number.int({ min: 0, max: 400 });
      const ratingAvg = ratingCount === 0 ? 0 : Number((3.5 + Math.random() * 1.5).toFixed(1));

      const product = await prisma.product.upsert({
        where: { slug },
        update: {},
        create: {
          sellerId,
          categoryId,
          brandId,
          name,
          slug,
          description,
          sku,
          priceCents,
          compareAtPriceCents,
          weightGrams: faker.number.int({ min: 100, max: 8000 }),
          isActive: true,
          ratingAvg,
          ratingCount,
          salesCount: faker.number.int({ min: 0, max: 1200 }),
        },
      });

      // Imagens (2 a 4)
      const imageCount = faker.number.int({ min: 2, max: 4 });
      for (let i = 0; i < imageCount; i++) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: placeholderUrl(`${slug}-${i}`),
            altText: name,
            position: i,
          },
        });
      }

      // Atributos (2 a 3)
      const chosenAttrs = faker.helpers.arrayElements(ATTRIBUTE_POOL, { min: 2, max: 3 });
      for (const [attrName, options] of chosenAttrs) {
        await prisma.productAttribute.create({
          data: {
            productId: product.id,
            name: attrName,
            value: faker.helpers.arrayElement(options as readonly string[]),
          },
        });
      }

      // ~25% dos produtos ganham variações (cor/tamanho) com estoque próprio;
      // os demais usam estoque direto no produto.
      const hasVariants = Math.random() < 0.25;
      if (hasVariants) {
        const colors = ["Preto", "Branco", "Azul"];
        for (const color of colors) {
          const variant = await prisma.productVariant.create({
            data: {
              productId: product.id,
              name: `Cor: ${color}`,
              sku: `${sku}-${color.slice(0, 2).toUpperCase()}`,
              attributes: { cor: color },
            },
          });
          await prisma.inventory.create({
            data: {
              variantId: variant.id,
              quantity: faker.number.int({ min: 0, max: 80 }),
            },
          });
        }
      } else {
        await prisma.inventory.create({
          data: {
            productId: product.id,
            quantity: faker.number.int({ min: 0, max: 200 }),
          },
        });
      }

      // Avaliações (0 a 5), só para produtos com ratingCount > 0
      if (ratingCount > 0) {
        const reviewsToCreate = faker.number.int({ min: 1, max: 5 });
        const reviewers = faker.helpers.arrayElements(buyerIds, {
          min: Math.min(reviewsToCreate, buyerIds.length),
          max: Math.min(reviewsToCreate, buyerIds.length),
        });
        for (const reviewerId of reviewers) {
          await prisma.review.upsert({
            where: { productId_userId: { productId: product.id, userId: reviewerId } },
            update: {},
            create: {
              productId: product.id,
              userId: reviewerId,
              rating: faker.number.int({ min: 3, max: 5 }),
              comment: faker.helpers.arrayElement([
                "Produto muito bom, chegou rápido e bem embalado.",
                "Superou minhas expectativas, recomendo!",
                "Qualidade boa pelo preço pago.",
                "Entrega rápida, produto conforme o anunciado.",
                "Já é a segunda vez que compro, sempre satisfeito.",
              ]),
              isVerifiedPurchase: Math.random() < 0.7,
            },
          });
        }
      }

      // Perguntas (0 a 2), algumas respondidas
      if (Math.random() < 0.5) {
        const askerId = faker.helpers.arrayElement(buyerIds);
        const answered = Math.random() < 0.7;
        await prisma.question.create({
          data: {
            productId: product.id,
            userId: askerId,
            question: faker.helpers.arrayElement([
              "Esse produto tem garantia?",
              "Qual o prazo de entrega para minha região?",
              "Vem com manual em português?",
              "Tem outras cores disponíveis?",
            ]),
            answer: answered
              ? "Sim! Qualquer dúvida estamos à disposição pelo chat da loja."
              : null,
            answeredAt: answered ? new Date() : null,
          },
        });
      }

      productCount++;
    }
  }
  console.log(`  ${productCount} produtos criados (com imagens, atributos e estoque).`);

  // ---- Cupons ---------------------------------------------------------------
  await prisma.coupon.upsert({
    where: { code: "BEMVINDO10" },
    update: {},
    create: {
      code: "BEMVINDO10",
      type: CouponType.PERCENTAGE,
      value: 10,
      minOrderCents: 5000,
      maxUses: 1000,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.coupon.upsert({
    where: { code: "FRETE20" },
    update: {},
    create: {
      code: "FRETE20",
      type: CouponType.FIXED,
      value: 2000,
      minOrderCents: 10000,
      maxUses: 500,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("  2 cupons criados (BEMVINDO10, FRETE20).");

  console.log("\nSeed concluído com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
