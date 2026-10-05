import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { AppError, conflict, notFound } from "@/server/errors";
import { audit } from "@/server/observability/audit";
import { slugify } from "@/lib/slug";
import { ufFromCepSafe } from "@/features/seller/cep";
import type { StoreProfileInput } from "@/features/seller/schemas";

const RESERVED_SLUGS = new Set(["mercatto", "oficial", "admin", "vendedor", "loja", "suporte", "ajuda"]);

async function uniqueStoreSlug(name: string, excludeId?: string) {
  const root = slugify(name, 60) || "loja";
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const [taken, redirected] = await Promise.all([
      db.store.findFirst({ where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } }),
      db.slugRedirect.findFirst({ where: { entity: "STORE", fromSlug: candidate }, select: { id: true } }),
    ]);
    if (!taken && !redirected) return candidate;
  }
  throw conflict("Não foi possível gerar um endereço único para a loja.");
}

/**
 * Onboarding: cliente vira vendedor criando sua loja. A loja nasce PENDING
 * (análise da Mercatto) — produtos podem ser cadastrados como rascunho, mas só
 * são publicados após aprovação (status ACTIVE) pelo administrador.
 */
export async function createSellerStore(userId: string, input: StoreProfileInput) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, status: true, store: { select: { id: true } } } });
  if (!user) throw notFound("Usuário não encontrado.");
  if (user.store) throw conflict("Você já possui uma loja.");
  if (user.role === "SUPPORT") throw new AppError("FORBIDDEN", "Contas de suporte não podem criar lojas.");
  const nameTaken = await db.store.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } }, select: { id: true } });
  if (nameTaken) throw conflict("Já existe uma loja com este nome.");
  const slug = await uniqueStoreSlug(input.name);
  try {
    const store = await db.$transaction(async (tx) => {
      const created = await tx.store.create({
        data: {
          ownerId: userId,
          name: input.name,
          slug,
          description: input.description ?? null,
          document: input.document,
          contactEmail: input.contactEmail ?? null,
          contactPhone: input.contactPhone ?? null,
          originCep: input.originCep,
          originCity: input.originCity ?? null,
          originState: input.originState ?? ufFromCepSafe(input.originCep),
          logoUrl: input.logoUrl ?? null,
          bannerUrl: input.bannerUrl ?? null,
          status: "PENDING",
        },
        select: { id: true, slug: true },
      });
      if (user.role === "CUSTOMER") {
        await tx.user.update({ where: { id: userId }, data: { role: "SELLER" } });
        await audit({ actorId: userId, action: "user.role_changed", entityType: "User", entityId: userId, before: { role: "CUSTOMER" }, after: { role: "SELLER", via: "seller_onboarding" } }, tx);
      }
      return created;
    });
    return store;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict("Loja já cadastrada.");
    throw error;
  }
}

export async function updateStoreProfile(storeId: string, actorId: string, input: StoreProfileInput) {
  const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true, slug: true, name: true, isOfficial: true } });
  if (!store) throw notFound("Loja não encontrada.");
  let slug = store.slug;
  if (input.name !== store.name && !store.isOfficial) {
    const taken = await db.store.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, id: { not: storeId } }, select: { id: true } });
    if (taken) throw conflict("Já existe uma loja com este nome.");
    slug = await uniqueStoreSlug(input.name, storeId);
  }
  await db.$transaction(async (tx) => {
    await tx.store.update({
      where: { id: storeId },
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        document: input.document,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        originCep: input.originCep,
        originCity: input.originCity ?? null,
        originState: input.originState ?? ufFromCepSafe(input.originCep),
        logoUrl: input.logoUrl ?? null,
        bannerUrl: input.bannerUrl ?? null,
      },
    });
    if (slug !== store.slug) {
      await tx.slugRedirect.deleteMany({ where: { entity: "STORE", fromSlug: slug } });
      await tx.slugRedirect.upsert({
        where: { entity_fromSlug: { entity: "STORE", fromSlug: store.slug } },
        update: { toSlug: slug },
        create: { entity: "STORE", fromSlug: store.slug, toSlug: slug },
      });
    }
  });
  await audit({ actorId, action: "store.status_changed", entityType: "Store", entityId: storeId, after: { profileUpdated: true, slug } });
  return { slug };
}

export async function getStoreSettingsForSeller(storeId: string) {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: {
      id: true, name: true, slug: true, description: true, document: true, contactEmail: true, contactPhone: true,
      originCep: true, originCity: true, originState: true, logoUrl: true, bannerUrl: true, status: true, isOfficial: true,
      ratingAvg: true, ratingCount: true, salesCount: true, cancelledCount: true, createdAt: true,
      shippingRules: { orderBy: [{ name: "asc" }, { regionCode: "asc" }, { maxWeightGrams: "asc" }] },
    },
  });
  if (!store) throw notFound("Loja não encontrada.");
  return store;
}

export async function replaceShippingRules(
  storeId: string,
  actorId: string,
  rules: { name: string; regionCode: string; maxWeightGrams: number; priceCents: number; additionalKgCents: number; minDays: number; maxDays: number; isActive: boolean }[],
) {
  if (rules.length > 100) throw new AppError("VALIDATION", "Máximo de 100 regras de frete.");
  await db.$transaction([
    db.shippingRule.deleteMany({ where: { storeId } }),
    db.shippingRule.createMany({ data: rules.map((r) => ({ ...r, storeId })) }),
  ]);
  await audit({ actorId, action: "settings.updated", entityType: "ShippingRule", entityId: storeId, after: { rules: rules.length } });
}
