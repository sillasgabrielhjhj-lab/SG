import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import { testPrisma as prisma } from "@/test/db";

/** Sufixo único por execução, para os dados de um teste nunca colidirem
 * com os de outro (os testes compartilham o mesmo banco mercatto_test). */
export function uniqueSuffix() {
  return randomUUID().slice(0, 8);
}

export async function createTestCategory(nameOverride?: string) {
  const suffix = uniqueSuffix();
  const name = nameOverride ?? `Categoria Teste ${suffix}`;
  return prisma.category.create({
    data: { name, slug: `categoria-teste-${suffix}` },
  });
}

export async function createTestBuyer() {
  const suffix = uniqueSuffix();
  const passwordHash = await bcrypt.hash("SenhaForte123", 4);
  return prisma.user.create({
    data: {
      name: `Comprador Teste ${suffix}`,
      email: `comprador.${suffix}@test.mercatto.dev`,
      passwordHash,
      role: "USER",
      emailVerified: new Date(),
    },
  });
}

export async function createTestSeller() {
  const suffix = uniqueSuffix();
  const passwordHash = await bcrypt.hash("SenhaForte123", 4);
  const user = await prisma.user.create({
    data: {
      name: `Vendedor Teste ${suffix}`,
      email: `vendedor.${suffix}@test.mercatto.dev`,
      passwordHash,
      role: "SELLER",
      emailVerified: new Date(),
    },
  });
  const seller = await prisma.seller.create({
    data: { userId: user.id, storeName: `Loja Teste ${suffix}`, slug: `loja-teste-${suffix}` },
  });
  return { user, seller };
}

export async function createTestProduct(options: {
  sellerId: string;
  categoryId: string;
  priceCents?: number;
  stock?: number;
  ratingAvg?: number;
  ratingCount?: number;
  isActive?: boolean;
  name?: string;
}) {
  const suffix = uniqueSuffix();
  const name = options.name ?? `Produto Teste ${suffix}`;
  const product = await prisma.product.create({
    data: {
      sellerId: options.sellerId,
      categoryId: options.categoryId,
      name,
      slug: `produto-teste-${suffix}`,
      description: "Produto criado para teste automatizado.",
      sku: `TEST-${suffix}`,
      priceCents: options.priceCents ?? 10000,
      isActive: options.isActive ?? true,
      ratingAvg: options.ratingAvg ?? 0,
      ratingCount: options.ratingCount ?? 0,
      images: { create: [{ url: "/placeholders/ph-0.svg", position: 0 }] },
    },
  });
  await prisma.inventory.create({
    data: { productId: product.id, quantity: options.stock ?? 10 },
  });
  return product;
}

export async function createTestAddress(userId: string) {
  return prisma.address.create({
    data: {
      userId,
      recipientName: "Comprador Teste",
      street: "Rua de Teste",
      number: "100",
      neighborhood: "Centro",
      city: "Recife",
      state: "PE",
      zipCode: "50000-000",
      isDefault: true,
    },
  });
}
