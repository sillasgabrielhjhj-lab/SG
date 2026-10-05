import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { recomputeProductAggregates } from "@/features/catalog/aggregates";

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** CPF válido gerado (dígitos verificadores corretos). */
export function makeCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  if (new Set(base).size === 1) base[0] = (base[0]! + 1) % 10;
  const dv = (digits: number[]) => {
    const sum = digits.reduce((acc, d, i) => acc + d * (digits.length + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

export async function ensureSettings(overrides: Partial<{ minOrderCents: number; freeShippingThresholdCents: number | null; pixDiscountPercent: number; orderReservationMinutes: number }> = {}) {
  await db.storeSettings.upsert({ where: { id: "default" }, update: overrides, create: { id: "default", ...overrides } });
}

export async function createUser(role: "CUSTOMER" | "SELLER" | "ADMIN" | "SUPPORT" = "CUSTOMER") {
  return db.user.create({
    data: { email: `u${uid()}@teste.dev`, name: "Usuário Teste", passwordHash: await hashPassword("Senha1234"), role },
  });
}

export async function createStore(opts: { isOfficial?: boolean; originCep?: string } = {}) {
  const owner = await createUser("SELLER");
  const store = await db.store.create({
    data: { ownerId: owner.id, name: `Loja ${uid()}`, slug: `loja-${uid()}`, originCep: opts.originCep ?? "01001000", originState: "SP", isOfficial: opts.isOfficial ?? false, status: "ACTIVE" },
  });
  // Regras de frete globais mínimas (idempotente por nome+região+peso).
  const has = await db.shippingRule.count({ where: { storeId: null } });
  if (!has) {
    await db.shippingRule.createMany({
      data: ["SAME_STATE", "SAME_REGION", "OTHER"].flatMap((regionCode, i) => [
        { name: "Padrão", regionCode, maxWeightGrams: 30000, priceCents: 1990 + i * 1000, additionalKgCents: 200, minDays: 2 + i, maxDays: 5 + i },
        { name: "Expresso", regionCode, maxWeightGrams: 30000, priceCents: 3490 + i * 1500, additionalKgCents: 300, minDays: 1, maxDays: 2 + i },
      ]),
    });
  }
  return { store, owner };
}

export async function createCategory() {
  return db.category.create({ data: { name: `Categoria ${uid()}`, slug: `cat-${uid()}` } });
}

export async function createProduct(opts: { storeId: string; categoryId?: string; priceCents?: number; stock?: number; name?: string; freeShipping?: boolean }) {
  const categoryId = opts.categoryId ?? (await createCategory()).id;
  const product = await db.product.create({
    data: {
      storeId: opts.storeId,
      categoryId,
      name: opts.name ?? `Produto ${uid()}`,
      slug: `produto-${uid()}`,
      description: "Produto de teste com descrição suficiente.",
      status: "ACTIVE",
      sku: `SKU-${uid()}`.toUpperCase(),
      freeShipping: opts.freeShipping ?? false,
      publishedAt: new Date(),
      images: { create: [{ url: "/demo-assets/p/smartphone/black/1.svg", position: 0 }] },
      variants: { create: [{ sku: `VAR-${uid()}`.toUpperCase(), name: "Padrão", optionValues: {}, priceCents: opts.priceCents ?? 10000, stock: opts.stock ?? 10 }] },
    },
    include: { variants: true },
  });
  await recomputeProductAggregates([product.id]);
  return { product, variant: product.variants[0]! };
}

export async function createAddress(userId: string) {
  return db.address.create({
    data: { userId, recipientName: "Cliente Teste", cep: "01310100", street: "Avenida Paulista", number: "1000", district: "Bela Vista", city: "São Paulo", state: "SP", isDefault: true },
  });
}

export async function putInCart(userId: string, variantId: string, quantity: number) {
  const cart = await db.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  await db.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId } }, update: { quantity }, create: { cartId: cart.id, variantId, quantity } });
  return cart;
}

export const newKey = () => randomUUID();
