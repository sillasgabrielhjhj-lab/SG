import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";
import { AppError, conflict, forbidden, notFound } from "@/server/errors";
import { audit } from "@/server/observability/audit";
import { logger } from "@/server/observability/logger";
import { slugify } from "@/lib/slug";
import { recomputeProductAggregates } from "@/features/catalog/aggregates";
import type { ProductInput } from "@/features/products/schemas";

/**
 * Gestão de produtos compartilhada entre o painel do VENDEDOR e o ADMIN.
 * O escopo define o que o ator pode tocar:
 *  - { kind: "store", storeId }  => somente produtos da própria loja (anti-IDOR)
 *  - { kind: "admin", storeId }  => administrador; storeId = loja dona ao CRIAR
 *    (por padrão a loja oficial Mercatto); pode editar produtos de qualquer loja.
 */
export type ProductScope = { kind: "store"; storeId: string } | { kind: "admin"; storeId: string };

const LOCKED_STATUSES = new Set(["ARCHIVED"]);

export async function getOfficialStoreId(): Promise<string> {
  const store = await db.store.findFirst({ where: { isOfficial: true }, select: { id: true }, orderBy: { createdAt: "asc" } });
  if (!store) throw new AppError("UNPROCESSABLE", "Loja oficial Mercatto não configurada. Rode o seed (modo minimal) ou crie a loja oficial.");
  return store.id;
}

async function loadOwnedProduct(scope: ProductScope, productId: string, tx: Tx | typeof db = db) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { id: true, storeId: true, slug: true, status: true, name: true, publishedAt: true },
  });
  if (!product) throw notFound("Produto não encontrado.");
  if (scope.kind === "store" && product.storeId !== scope.storeId) throw notFound("Produto não encontrado.");
  return product;
}

async function ensureUniqueSlug(base: string, excludeProductId?: string): Promise<string> {
  const root = slugify(base) || "produto";
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const [taken, redirected] = await Promise.all([
      db.product.findFirst({ where: { slug: candidate, ...(excludeProductId ? { id: { not: excludeProductId } } : {}) }, select: { id: true } }),
      db.slugRedirect.findFirst({ where: { entity: "PRODUCT", fromSlug: candidate }, select: { toSlug: true } }),
    ]);
    // Um slug antigo redirecionado pode ser reutilizado apenas pelo próprio produto.
    if (!taken && !redirected) return candidate;
    if (!taken && redirected && excludeProductId) {
      const own = await db.product.findFirst({ where: { id: excludeProductId, slug: redirected.toSlug }, select: { id: true } });
      if (own) return candidate;
    }
  }
  throw conflict("Não foi possível gerar um endereço (slug) único. Informe um slug manualmente.");
}

async function validateReferences(input: ProductInput, tx: Tx) {
  const category = await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true, isActive: true } });
  if (!category || !category.isActive) throw new AppError("VALIDATION", "Categoria inválida.", { fieldErrors: { categoryId: ["Categoria inválida"] } });
  if (input.brandId) {
    const brand = await tx.brand.findUnique({ where: { id: input.brandId }, select: { id: true } });
    if (!brand) throw new AppError("VALIDATION", "Marca inválida.", { fieldErrors: { brandId: ["Marca inválida"] } });
  }
  if (input.attributes.length) {
    const attrIds = input.attributes.map((a) => a.attributeId);
    const valid = await tx.categoryAttribute.findMany({ where: { id: { in: attrIds } }, select: { id: true, type: true, options: true } });
    const byId = new Map(valid.map((a) => [a.id, a]));
    for (const a of input.attributes) {
      const def = byId.get(a.attributeId);
      if (!def) throw new AppError("VALIDATION", "Atributo inválido para a categoria.");
      if (def.type === "SELECT" && a.value && !def.options.includes(a.value)) {
        throw new AppError("VALIDATION", `Valor inválido para o atributo.`);
      }
    }
  }
}

function variantName(optionValues: Record<string, string>, options: ProductInput["options"]) {
  if (options.length === 0) return "Padrão";
  return options.map((o) => optionValues[o.name]).filter(Boolean).join(" · ");
}

function mapSkuConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = String((error.meta as { target?: unknown } | undefined)?.target ?? "");
    if (target.includes("sku")) throw conflict("Já existe um produto ou variação com este SKU. Use um SKU único.");
    if (target.includes("slug")) throw conflict("Este endereço (slug) já está em uso.");
    throw conflict("Registro duplicado.");
  }
  throw error;
}

/** Aplica um delta de estoque de forma atômica, registrando a movimentação. */
async function applyStockDelta(
  tx: Tx,
  variantId: string,
  delta: number,
  type: "IN" | "ADJUSTMENT",
  reason: string,
  actorId: string,
) {
  if (delta === 0) return;
  const where = delta < 0 ? { id: variantId, stock: { gte: -delta } } : { id: variantId };
  const { count } = await tx.productVariant.updateMany({ where, data: { stock: { increment: delta } } });
  if (count !== 1) throw new AppError("CONFLICT", "O estoque mudou durante a edição (vendas recentes). Recarregue e tente novamente.");
  const v = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
  await tx.inventoryMovement.create({
    data: { variantId, type, quantity: delta, balanceAfter: v.stock, reason, actorId },
  });
}

export async function createProduct(scope: ProductScope, actorId: string, input: ProductInput) {
  const slug = await ensureUniqueSlug(input.slug ?? input.name);
  try {
    const productId = await db.$transaction(async (tx) => {
      await validateReferences(input, tx);
      const store = await tx.store.findUnique({ where: { id: scope.storeId }, select: { status: true } });
      if (!store) throw notFound("Loja não encontrada.");
      if (input.status === "ACTIVE" && store.status !== "ACTIVE") {
        throw new AppError("UNPROCESSABLE", "Sua loja ainda não está ativa. Salve como rascunho até a aprovação.");
      }

      const product = await tx.product.create({
        data: {
          storeId: scope.storeId,
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          name: input.name,
          slug,
          shortDescription: input.shortDescription ?? null,
          description: input.description,
          condition: input.condition,
          status: input.status,
          sku: input.sku,
          gtin: input.gtin ?? null,
          tags: input.tags,
          warrantyMonths: input.warrantyMonths ?? null,
          warrantyText: input.warrantyText ?? null,
          includedItems: input.includedItems,
          specifications: input.specifications as Prisma.InputJsonValue,
          weightGrams: input.weightGrams,
          heightCm: input.heightCm,
          widthCm: input.widthCm,
          lengthCm: input.lengthCm,
          freeShipping: input.freeShipping,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          isFeatured: scope.kind === "admin" ? Boolean(input.isFeatured) : false,
          publishedAt: input.status === "ACTIVE" ? new Date() : null,
        },
        select: { id: true },
      });

      const images = await Promise.all(
        input.images.map((img, position) =>
          tx.productImage.create({
            data: {
              productId: product.id,
              url: img.url,
              storageKey: img.storageKey ?? null,
              alt: img.alt ?? input.name,
              width: img.width ?? null,
              height: img.height ?? null,
              position,
            },
            select: { id: true },
          }),
        ),
      );

      for (const [position, option] of input.options.entries()) {
        await tx.productOption.create({ data: { productId: product.id, name: option.name, values: option.values, position } });
      }

      for (const [position, v] of input.variants.entries()) {
        const variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: v.sku,
            gtin: v.gtin ?? null,
            name: variantName(v.optionValues, input.options),
            optionValues: v.optionValues,
            priceCents: v.priceCents,
            compareAtPriceCents: v.compareAtPriceCents ?? null,
            costCents: v.costCents ?? null,
            stock: 0,
            minStock: v.minStock,
            weightGrams: v.weightGrams ?? null,
            imageId: v.imageIndex !== null && v.imageIndex !== undefined ? (images[v.imageIndex]?.id ?? null) : null,
            status: v.status,
            position,
          },
          select: { id: true },
        });
        await applyStockDelta(tx, variant.id, v.stock, "IN", "Estoque inicial", actorId);
      }

      for (const a of input.attributes.filter((x) => x.value)) {
        await tx.productAttributeValue.create({ data: { productId: product.id, attributeId: a.attributeId, value: a.value } });
      }

      await audit(
        {
          actorId,
          action: "product.created",
          entityType: "Product",
          entityId: product.id,
          after: { name: input.name, status: input.status, storeId: scope.storeId, variants: input.variants.map((v) => ({ sku: v.sku, priceCents: v.priceCents })) },
        },
        tx,
      );
      return product.id;
    });
    await recomputeProductAggregates([productId]);
    return { id: productId, slug };
  } catch (error) {
    mapSkuConflict(error);
  }
}

export async function updateProduct(scope: ProductScope, actorId: string, productId: string, input: ProductInput) {
  const current = await loadOwnedProduct(scope, productId);
  if (LOCKED_STATUSES.has(current.status)) throw new AppError("UNPROCESSABLE", "Produto arquivado não pode ser editado. Duplique-o para criar um novo anúncio.");

  const desiredSlug = input.slug ?? current.slug;
  const slug = desiredSlug === current.slug ? current.slug : await ensureUniqueSlug(desiredSlug, productId);
  const removedImageKeys: string[] = [];

  try {
    await db.$transaction(async (tx) => {
      await validateReferences(input, tx);

      const existing = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: {
          images: { select: { id: true, storageKey: true, url: true } },
          variants: { select: { id: true, sku: true, priceCents: true, compareAtPriceCents: true, stock: true, _count: { select: { orderItems: true } } } },
        },
      });

      // --- Imagens: mantém/atualiza as informadas, cria novas, remove as ausentes.
      const keepIds = new Set(input.images.map((i) => i.id).filter(Boolean) as string[]);
      const existingImageIds = new Set(existing.images.map((i) => i.id));
      const toRemove = existing.images.filter((i) => !keepIds.has(i.id));
      if (toRemove.length) {
        await tx.productImage.deleteMany({ where: { id: { in: toRemove.map((i) => i.id) } } });
        removedImageKeys.push(...(toRemove.map((i) => i.storageKey).filter(Boolean) as string[]));
      }
      const imageIds: string[] = [];
      for (const [position, img] of input.images.entries()) {
        if (img.id && existingImageIds.has(img.id)) {
          await tx.productImage.update({ where: { id: img.id }, data: { position, alt: img.alt ?? input.name } });
          imageIds.push(img.id);
        } else {
          const created = await tx.productImage.create({
            data: {
              productId,
              url: img.url,
              storageKey: img.storageKey ?? null,
              alt: img.alt ?? input.name,
              width: img.width ?? null,
              height: img.height ?? null,
              position,
            },
            select: { id: true },
          });
          imageIds.push(created.id);
        }
      }

      // --- Opções de variação (substituição completa).
      await tx.productOption.deleteMany({ where: { productId } });
      for (const [position, option] of input.options.entries()) {
        await tx.productOption.create({ data: { productId, name: option.name, values: option.values, position } });
      }

      // --- Variantes.
      const existingById = new Map(existing.variants.map((v) => [v.id, v]));
      const keptVariantIds = new Set<string>();
      const priceChanges: { sku: string; before: number; after: number }[] = [];
      for (const [position, v] of input.variants.entries()) {
        const imageId = v.imageIndex !== null && v.imageIndex !== undefined ? (imageIds[v.imageIndex] ?? null) : null;
        const prev = v.id ? existingById.get(v.id) : undefined;
        if (prev) {
          keptVariantIds.add(prev.id);
          if (prev.priceCents !== v.priceCents) priceChanges.push({ sku: v.sku, before: prev.priceCents, after: v.priceCents });
          await tx.productVariant.update({
            where: { id: prev.id },
            data: {
              sku: v.sku,
              gtin: v.gtin ?? null,
              name: variantName(v.optionValues, input.options),
              optionValues: v.optionValues,
              priceCents: v.priceCents,
              compareAtPriceCents: v.compareAtPriceCents ?? null,
              costCents: v.costCents ?? null,
              minStock: v.minStock,
              weightGrams: v.weightGrams ?? null,
              imageId,
              status: v.status,
              position,
            },
          });
          const baseline = v.stockBaseline ?? prev.stock;
          await applyStockDelta(tx, prev.id, v.stock - baseline, "ADJUSTMENT", "Ajuste pelo editor de produto", actorId);
        } else {
          const created = await tx.productVariant.create({
            data: {
              productId,
              sku: v.sku,
              gtin: v.gtin ?? null,
              name: variantName(v.optionValues, input.options),
              optionValues: v.optionValues,
              priceCents: v.priceCents,
              compareAtPriceCents: v.compareAtPriceCents ?? null,
              costCents: v.costCents ?? null,
              stock: 0,
              minStock: v.minStock,
              weightGrams: v.weightGrams ?? null,
              imageId,
              status: v.status,
              position,
            },
            select: { id: true },
          });
          keptVariantIds.add(created.id);
          await applyStockDelta(tx, created.id, v.stock, "IN", "Estoque inicial", actorId);
        }
      }
      // Variantes removidas: inativa se já vendidas (histórico), senão exclui.
      for (const old of existing.variants) {
        if (keptVariantIds.has(old.id)) continue;
        if (old._count.orderItems > 0) {
          await tx.productVariant.update({ where: { id: old.id }, data: { status: "INACTIVE" } });
        } else {
          await tx.cartItem.deleteMany({ where: { variantId: old.id } });
          await tx.productVariant.delete({ where: { id: old.id } });
        }
      }

      // --- Atributos.
      await tx.productAttributeValue.deleteMany({ where: { productId } });
      for (const a of input.attributes.filter((x) => x.value)) {
        await tx.productAttributeValue.create({ data: { productId, attributeId: a.attributeId, value: a.value } });
      }

      // --- Produto.
      const nextStatus = current.status === "OUT_OF_STOCK" && input.status === "ACTIVE" ? "ACTIVE" : input.status;
      await tx.product.update({
        where: { id: productId },
        data: {
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          name: input.name,
          slug,
          shortDescription: input.shortDescription ?? null,
          description: input.description,
          condition: input.condition,
          status: nextStatus,
          sku: input.sku,
          gtin: input.gtin ?? null,
          tags: input.tags,
          warrantyMonths: input.warrantyMonths ?? null,
          warrantyText: input.warrantyText ?? null,
          includedItems: input.includedItems,
          specifications: input.specifications as Prisma.InputJsonValue,
          weightGrams: input.weightGrams,
          heightCm: input.heightCm,
          widthCm: input.widthCm,
          lengthCm: input.lengthCm,
          freeShipping: input.freeShipping,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          ...(scope.kind === "admin" && input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
          ...(nextStatus === "ACTIVE" && !current.publishedAt ? { publishedAt: new Date() } : {}),
        },
      });

      // --- Redirecionamento 301 do slug antigo.
      if (slug !== current.slug) {
        await tx.slugRedirect.deleteMany({ where: { entity: "PRODUCT", fromSlug: slug } });
        await tx.slugRedirect.updateMany({ where: { entity: "PRODUCT", toSlug: current.slug }, data: { toSlug: slug } });
        await tx.slugRedirect.upsert({
          where: { entity_fromSlug: { entity: "PRODUCT", fromSlug: current.slug } },
          update: { toSlug: slug },
          create: { entity: "PRODUCT", fromSlug: current.slug, toSlug: slug },
        });
      }

      await audit({ actorId, action: "product.updated", entityType: "Product", entityId: productId, after: { name: input.name, status: nextStatus, slug } }, tx);
      if (priceChanges.length) {
        await audit(
          { actorId, action: "product.price_changed", entityType: "Product", entityId: productId, before: priceChanges.map((c) => ({ sku: c.sku, priceCents: c.before })), after: priceChanges.map((c) => ({ sku: c.sku, priceCents: c.after })) },
          tx,
        );
      }
    });
  } catch (error) {
    mapSkuConflict(error);
  }

  await recomputeProductAggregates([productId]);
  await deleteStoredImagesSafely(removedImageKeys);
  return { id: productId, slug };
}

async function deleteStoredImagesSafely(keys: string[]) {
  if (!keys.length) return;
  try {
    // Só remove do storage se nenhuma outra imagem (ex.: produto duplicado) usa a mesma chave.
    const stillUsed = await db.productImage.findMany({ where: { storageKey: { in: keys } }, select: { storageKey: true } });
    const used = new Set(stillUsed.map((i) => i.storageKey));
    const { getStorageProvider } = await import("@/server/providers/storage");
    for (const key of keys.filter((k) => !used.has(k))) {
      await getStorageProvider().delete(key);
    }
  } catch (error) {
    logger.warn("products.image_cleanup_failed", { error });
  }
}

export async function setProductStatus(scope: ProductScope, actorId: string, productId: string, status: "DRAFT" | "ACTIVE" | "PAUSED") {
  const product = await loadOwnedProduct(scope, productId);
  if (LOCKED_STATUSES.has(product.status)) throw new AppError("UNPROCESSABLE", "Produto arquivado.");
  if (status === "ACTIVE") {
    const full = await db.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        _count: { select: { images: true } },
        variants: { where: { status: "ACTIVE" }, select: { id: true, priceCents: true } },
        category: { select: { isActive: true } },
        store: { select: { status: true } },
      },
    });
    if (full._count.images === 0) throw new AppError("UNPROCESSABLE", "Adicione pelo menos uma foto antes de publicar.");
    if (full.variants.length === 0) throw new AppError("UNPROCESSABLE", "Ative pelo menos uma variação antes de publicar.");
    const unpriced = full.variants.filter((v) => v.priceCents <= 0).length;
    if (unpriced > 0) throw new AppError("UNPROCESSABLE", `Defina o preço de todas as variações ativas antes de publicar (${unpriced} sem preço) — ou desative as que você não vende.`);
    if (!full.category.isActive) throw new AppError("UNPROCESSABLE", "A categoria do produto está inativa.");
    if (full.store.status !== "ACTIVE") throw new AppError("UNPROCESSABLE", "A loja precisa estar ativa para publicar.");
  }
  await db.product.update({
    where: { id: productId },
    data: { status, ...(status === "ACTIVE" && !product.publishedAt ? { publishedAt: new Date() } : {}) },
  });
  await audit({ actorId, action: "product.status_changed", entityType: "Product", entityId: productId, before: { status: product.status }, after: { status } });
  await recomputeProductAggregates([productId]);
}

/** Arquivamento (exclusão lógica). Produtos nunca vendidos e em rascunho podem ser excluídos de fato. */
export async function archiveOrDeleteProduct(scope: ProductScope, actorId: string, productId: string) {
  const product = await loadOwnedProduct(scope, productId);
  const sold = await db.orderItem.count({ where: { productId } });
  if (sold === 0 && product.status === "DRAFT") {
    const images = await db.productImage.findMany({ where: { productId }, select: { storageKey: true } });
    await db.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({ where: { productId }, select: { id: true } });
      await tx.cartItem.deleteMany({ where: { variantId: { in: variants.map((v) => v.id) } } });
      await tx.product.delete({ where: { id: productId } });
      await audit({ actorId, action: "product.archived", entityType: "Product", entityId: productId, after: { deleted: true, name: product.name } }, tx);
    });
    await deleteStoredImagesSafely(images.map((i) => i.storageKey).filter(Boolean) as string[]);
    return { deleted: true };
  }
  await db.product.update({ where: { id: productId }, data: { status: "ARCHIVED", isFeatured: false } });
  await audit({ actorId, action: "product.archived", entityType: "Product", entityId: productId, before: { status: product.status }, after: { status: "ARCHIVED" } });
  return { deleted: false };
}

/** Restaura um produto arquivado como rascunho. */
export async function restoreProduct(scope: ProductScope, actorId: string, productId: string) {
  const product = await loadOwnedProduct(scope, productId);
  if (product.status !== "ARCHIVED") return;
  await db.product.update({ where: { id: productId }, data: { status: "DRAFT" } });
  await audit({ actorId, action: "product.status_changed", entityType: "Product", entityId: productId, before: { status: "ARCHIVED" }, after: { status: "DRAFT" } });
  await recomputeProductAggregates([productId]);
}

export async function duplicateProduct(scope: ProductScope, actorId: string, productId: string) {
  await loadOwnedProduct(scope, productId);
  const src = await db.product.findUniqueOrThrow({
    where: { id: productId },
    include: { images: { orderBy: { position: "asc" } }, options: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } }, attributes: true },
  });
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const slug = await ensureUniqueSlug(`${src.name} copia`);
  try {
    const id = await db.$transaction(async (tx) => {
      const copy = await tx.product.create({
        data: {
          storeId: src.storeId,
          categoryId: src.categoryId,
          brandId: src.brandId,
          name: `${src.name} (cópia)`.slice(0, 160),
          slug,
          shortDescription: src.shortDescription,
          description: src.description,
          condition: src.condition,
          status: "DRAFT",
          sku: `${src.sku}-C${suffix}`.slice(0, 64),
          gtin: null,
          tags: src.tags,
          warrantyMonths: src.warrantyMonths,
          warrantyText: src.warrantyText,
          includedItems: src.includedItems,
          specifications: (src.specifications ?? []) as Prisma.InputJsonValue,
          weightGrams: src.weightGrams,
          heightCm: src.heightCm,
          widthCm: src.widthCm,
          lengthCm: src.lengthCm,
          freeShipping: src.freeShipping,
          seoTitle: null,
          seoDescription: src.seoDescription,
          isDemo: false,
        },
        select: { id: true },
      });
      const imageMap = new Map<string, string>();
      for (const img of src.images) {
        // A cópia compartilha o arquivo; storageKey nulo evita apagar o original.
        const created = await tx.productImage.create({
          data: { productId: copy.id, url: img.url, storageKey: null, alt: img.alt, width: img.width, height: img.height, position: img.position },
          select: { id: true },
        });
        imageMap.set(img.id, created.id);
      }
      for (const o of src.options) await tx.productOption.create({ data: { productId: copy.id, name: o.name, values: o.values, position: o.position } });
      for (const v of src.variants) {
        await tx.productVariant.create({
          data: {
            productId: copy.id,
            sku: `${v.sku}-C${suffix}`.slice(0, 64),
            name: v.name,
            optionValues: v.optionValues as Prisma.InputJsonValue,
            priceCents: v.priceCents,
            compareAtPriceCents: v.compareAtPriceCents,
            costCents: v.costCents,
            stock: 0,
            minStock: v.minStock,
            weightGrams: v.weightGrams,
            imageId: v.imageId ? (imageMap.get(v.imageId) ?? null) : null,
            status: v.status,
            position: v.position,
          },
        });
      }
      for (const a of src.attributes) await tx.productAttributeValue.create({ data: { productId: copy.id, attributeId: a.attributeId, value: a.value } });
      await audit({ actorId, action: "product.duplicated", entityType: "Product", entityId: copy.id, before: { sourceId: productId } }, tx);
      return copy.id;
    });
    await recomputeProductAggregates([id]);
    return { id, slug };
  } catch (error) {
    mapSkuConflict(error);
  }
}

/** Alteração rápida de preço (lista de produtos). */
export async function updateVariantPrice(
  scope: ProductScope,
  actorId: string,
  input: { variantId: string; priceCents: number; compareAtPriceCents?: number | null },
) {
  const variant = await db.productVariant.findUnique({
    where: { id: input.variantId },
    select: { id: true, sku: true, priceCents: true, compareAtPriceCents: true, productId: true, product: { select: { storeId: true } } },
  });
  if (!variant) throw notFound("Variação não encontrada.");
  if (scope.kind === "store" && variant.product.storeId !== scope.storeId) throw forbidden();
  await db.productVariant.update({
    where: { id: variant.id },
    data: { priceCents: input.priceCents, compareAtPriceCents: input.compareAtPriceCents ?? null },
  });
  await audit({
    actorId,
    action: "product.price_changed",
    entityType: "ProductVariant",
    entityId: variant.id,
    before: { sku: variant.sku, priceCents: variant.priceCents, compareAtPriceCents: variant.compareAtPriceCents },
    after: { sku: variant.sku, priceCents: input.priceCents, compareAtPriceCents: input.compareAtPriceCents ?? null },
  });
  await recomputeProductAggregates([variant.productId]);
}
