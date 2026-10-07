import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { AppError, conflict, notFound } from "@/server/errors";
import { audit } from "@/server/observability/audit";
import { slugify } from "@/lib/slug";
import { destroyAllSessions } from "@/server/auth/session";
import { notify } from "@/features/notifications/service";
import type { attributeSchema, bannerSchema, brandSchema, categorySchema, settingsSchema } from "@/features/admin/schemas";

function dup(error: unknown, msg: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict(msg);
  throw error;
}

// ---------------------------------------------------------------- Categorias
export async function saveCategory(actorId: string, id: string | null, input: z.infer<typeof categorySchema>) {
  const slug = input.slug ?? slugify(input.name);
  if (input.parentId) {
    if (input.parentId === id) throw new AppError("VALIDATION", "Uma categoria não pode ser pai dela mesma.");
    // Evita ciclos: o novo pai não pode ser descendente.
    let cur: string | null = input.parentId;
    let guard = 0;
    while (cur && guard++ < 20) {
      if (cur === id) throw new AppError("VALIDATION", "Hierarquia inválida (ciclo).");
      cur = (await db.category.findUnique({ where: { id: cur }, select: { parentId: true } }))?.parentId ?? null;
    }
  }
  const data = {
    name: input.name, slug, description: input.description ?? null, icon: input.icon ?? null, imageUrl: input.imageUrl ?? null,
    parentId: input.parentId ?? null, position: input.position, isActive: input.isActive, isFeatured: input.isFeatured,
    seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null,
  };
  try {
    if (id) {
      const categoryId = id;
      const current = await db.category.findUnique({ where: { id: categoryId }, select: { slug: true } });
      if (!current) throw notFound("Categoria não encontrada.");
      await db.$transaction(async (tx) => {
        await tx.category.update({ where: { id: categoryId }, data });
        if (current.slug !== slug) {
          await tx.slugRedirect.deleteMany({ where: { entity: "CATEGORY", fromSlug: slug } });
          await tx.slugRedirect.upsert({ where: { entity_fromSlug: { entity: "CATEGORY", fromSlug: current.slug } }, update: { toSlug: slug }, create: { entity: "CATEGORY", fromSlug: current.slug, toSlug: slug } });
        }
      });
    } else {
      id = (await db.category.create({ data, select: { id: true } })).id;
    }
  } catch (error) {
    dup(error, "Já existe uma categoria com este slug.");
  }
  await audit({ actorId, action: "category.changed", entityType: "Category", entityId: id, after: { name: input.name, slug, isActive: input.isActive } });
  return { id };
}

export async function deleteCategory(actorId: string, id: string) {
  const [products, children] = await Promise.all([db.product.count({ where: { categoryId: id } }), db.category.count({ where: { parentId: id } })]);
  if (products || children) throw new AppError("UNPROCESSABLE", "Categoria com produtos ou subcategorias não pode ser excluída. Desative-a.");
  await db.category.delete({ where: { id } });
  await audit({ actorId, action: "category.changed", entityType: "Category", entityId: id, after: { deleted: true } });
}

export async function saveAttribute(actorId: string, id: string | null, input: z.infer<typeof attributeSchema>) {
  if (input.type === "SELECT" && input.options.length === 0) throw new AppError("VALIDATION", "Informe as opções da lista.");
  const data = { ...input, unit: input.unit ?? null };
  try {
    const saved = id ? await db.categoryAttribute.update({ where: { id }, data }) : await db.categoryAttribute.create({ data });
    await audit({ actorId, action: "category.changed", entityType: "CategoryAttribute", entityId: saved.id, after: { key: input.key } });
    return { id: saved.id };
  } catch (error) {
    dup(error, "Já existe um atributo com esta chave nesta categoria.");
  }
}

export async function deleteAttribute(actorId: string, id: string) {
  await db.categoryAttribute.delete({ where: { id } });
  await audit({ actorId, action: "category.changed", entityType: "CategoryAttribute", entityId: id, after: { deleted: true } });
}

// ---------------------------------------------------------------- Marcas
export async function saveBrand(actorId: string, id: string | null, input: z.infer<typeof brandSchema>) {
  const data = { name: input.name, slug: input.slug ?? slugify(input.name), logoUrl: input.logoUrl ?? null, isFeatured: input.isFeatured };
  try {
    const saved = id ? await db.brand.update({ where: { id }, data }) : await db.brand.create({ data });
    await audit({ actorId, action: "brand.changed", entityType: "Brand", entityId: saved.id, after: data });
    return { id: saved.id };
  } catch (error) {
    dup(error, "Já existe uma marca com este slug.");
  }
}

export async function deleteBrand(actorId: string, id: string) {
  const products = await db.product.count({ where: { brandId: id } });
  if (products) throw new AppError("UNPROCESSABLE", `A marca possui ${products} produto(s). Altere-os antes de excluir.`);
  await db.brand.delete({ where: { id } });
  await audit({ actorId, action: "brand.changed", entityType: "Brand", entityId: id, after: { deleted: true } });
}

// ---------------------------------------------------------------- Banners
export async function saveBanner(actorId: string, id: string | null, input: z.infer<typeof bannerSchema>) {
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new AppError("VALIDATION", "O término deve ser depois do início.");
  const data = {
    title: input.title, subtitle: input.subtitle ?? null, eyebrow: input.eyebrow ?? null, ctaLabel: input.ctaLabel ?? null, link: input.link,
    imageUrl: input.imageUrl ?? null, mobileImageUrl: input.mobileImageUrl ?? null, theme: input.theme, placement: input.placement,
    position: input.position, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, isActive: input.isActive,
  };
  const saved = id ? await db.banner.update({ where: { id }, data }) : await db.banner.create({ data });
  await audit({ actorId, action: "banner.changed", entityType: "Banner", entityId: saved.id, after: { title: input.title, placement: input.placement, isActive: input.isActive } });
  return { id: saved.id };
}

export async function deleteBanner(actorId: string, id: string) {
  await db.banner.delete({ where: { id } });
  await audit({ actorId, action: "banner.changed", entityType: "Banner", entityId: id, after: { deleted: true } });
}

// ---------------------------------------------------------------- Configurações
export async function updateSettings(actorId: string, input: z.infer<typeof settingsSchema>) {
  const before = await db.storeSettings.findUnique({ where: { id: "default" } });
  const { instagram, facebook, tiktok, youtube, x, ...rest } = input;
  const data = {
    ...rest,
    tagline: rest.tagline ?? null, logoUrl: rest.logoUrl ?? null, faviconUrl: rest.faviconUrl ?? null, contactEmail: rest.contactEmail ?? null,
    contactPhone: rest.contactPhone ?? null, whatsapp: rest.whatsapp ?? null,
    companyLegalName: rest.companyLegalName ?? null, companyDocument: rest.companyDocument ?? null, companyAddress: rest.companyAddress ?? null, supportHours: rest.supportHours ?? null, seoTitle: rest.seoTitle ?? null, seoDescription: rest.seoDescription ?? null,
    freeShippingThresholdCents: rest.freeShippingThresholdCents ?? null,
    welcomeCouponCode: rest.welcomeCouponCode || null,
    socialLinks: { instagram: instagram ?? null, facebook: facebook ?? null, tiktok: tiktok ?? null, youtube: youtube ?? null, x: x ?? null },
  };
  await db.storeSettings.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  await audit({ actorId, action: "settings.updated", entityType: "StoreSettings", entityId: "default", before: before ? JSON.parse(JSON.stringify(before)) : undefined, after: JSON.parse(JSON.stringify(data)) });
}

// ---------------------------------------------------------------- Usuários e lojas
export async function changeUserRole(actorId: string, userId: string, role: "CUSTOMER" | "SELLER" | "ADMIN" | "SUPPORT") {
  if (actorId === userId) throw new AppError("UNPROCESSABLE", "Você não pode alterar o próprio papel.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw notFound("Usuário não encontrado.");
  if (user.role === "ADMIN" && role !== "ADMIN") {
    const admins = await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (admins <= 1) throw new AppError("UNPROCESSABLE", "É necessário manter pelo menos um administrador.");
  }
  await db.user.update({ where: { id: userId }, data: { role } });
  // Revoga sessões: as novas permissões passam a valer no próximo login.
  await destroyAllSessions(userId);
  await audit({ actorId, action: "user.role_changed", entityType: "User", entityId: userId, before: { role: user.role }, after: { role } });
}

export async function changeUserStatus(actorId: string, userId: string, status: "ACTIVE" | "SUSPENDED") {
  if (actorId === userId) throw new AppError("UNPROCESSABLE", "Você não pode suspender a própria conta.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { status: true, role: true } });
  if (!user) throw notFound("Usuário não encontrado.");
  await db.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED") await destroyAllSessions(userId);
  await audit({ actorId, action: "user.status_changed", entityType: "User", entityId: userId, before: { status: user.status }, after: { status } });
}

export async function changeStoreStatus(actorId: string, storeId: string, status: "PENDING" | "ACTIVE" | "SUSPENDED", note?: string) {
  const store = await db.store.findUnique({ where: { id: storeId }, select: { status: true, ownerId: true, isOfficial: true, name: true } });
  if (!store) throw notFound("Loja não encontrada.");
  if (store.isOfficial && status !== "ACTIVE") throw new AppError("UNPROCESSABLE", "A loja oficial não pode ser suspensa.");
  await db.store.update({ where: { id: storeId }, data: { status } });
  if (status === "SUSPENDED") await db.product.updateMany({ where: { storeId, status: "ACTIVE" }, data: { status: "PAUSED" } });
  await audit({ actorId, action: "store.status_changed", entityType: "Store", entityId: storeId, before: { status: store.status }, after: { status, note: note ?? null } });
  await notify({
    userId: store.ownerId,
    type: "SYSTEM",
    title: status === "ACTIVE" ? "Sua loja foi aprovada!" : status === "SUSPENDED" ? "Sua loja foi suspensa" : "Sua loja está em análise",
    body: status === "ACTIVE" ? `${store.name} já pode publicar anúncios.` : (note ?? "Entre em contato com o suporte para mais detalhes."),
    link: "/vendedor",
  });
}
