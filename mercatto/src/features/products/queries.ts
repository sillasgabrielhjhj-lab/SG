import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import type { ProductListFilters } from "@/features/products/schemas";
import type { ProductScope } from "@/features/products/service";

const PAGE_SIZE = 20;

/** Lista de produtos gerenciáveis (vendedor: só a própria loja; admin: todos ou por loja). */
export async function listManagedProducts(scope: ProductScope | { kind: "admin-all" }, filters: ProductListFilters) {
  const where: Prisma.ProductWhereInput = {
    ...(scope.kind === "store" ? { storeId: scope.storeId } : {}),
    ...(scope.kind === "admin" ? { storeId: scope.storeId } : {}),
    ...(scope.kind === "admin-all" && filters.storeId ? { storeId: filters.storeId } : {}),
    ...(filters.status ? { status: filters.status } : { status: { not: "ARCHIVED" } }),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { sku: { contains: filters.q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: filters.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(filters.lowStock ? { variants: { some: { status: "ACTIVE", stock: { lte: 5 } } } } : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    filters.sort === "name"
      ? [{ name: "asc" }]
      : filters.sort === "price_asc"
        ? [{ minPriceCents: "asc" }]
        : filters.sort === "price_desc"
          ? [{ minPriceCents: "desc" }]
          : filters.sort === "stock"
            ? [{ totalStock: "asc" }]
            : filters.sort === "sales"
              ? [{ salesCount: "desc" }]
              : [{ updatedAt: "desc" }];

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [...orderBy, { id: "asc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        status: true,
        isFeatured: true,
        minPriceCents: true,
        effectivePriceCents: true,
        totalStock: true,
        salesCount: true,
        viewCount: true,
        updatedAt: true,
        isDemo: true,
        category: { select: { name: true } },
        store: { select: { id: true, name: true, isOfficial: true } },
        images: { take: 1, orderBy: { position: "asc" }, select: { url: true, alt: true } },
        variants: {
          orderBy: { position: "asc" },
          select: { id: true, sku: true, name: true, priceCents: true, compareAtPriceCents: true, stock: true, minStock: true, status: true },
        },
      },
    }),
    db.product.count({ where }),
  ]);
  return { items, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), pageSize: PAGE_SIZE };
}

export type ManagedProductRow = Awaited<ReturnType<typeof listManagedProducts>>["items"][number];

/** Dados completos para o editor (inclui estoque atual como baseline). */
export async function getProductForEdit(scope: ProductScope, productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      images: { orderBy: { position: "asc" } },
      options: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
      attributes: true,
      store: { select: { id: true, name: true, isOfficial: true } },
    },
  });
  if (!product || (scope.kind === "store" && product.storeId !== scope.storeId)) throw notFound("Produto não encontrado.");
  const imageIndexById = new Map(product.images.map((img, i) => [img.id, i]));
  return {
    id: product.id,
    store: product.store,
    status: product.status,
    isDemo: product.isDemo,
    input: {
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      categoryId: product.categoryId,
      brandId: product.brandId,
      condition: product.condition,
      status: (product.status === "OUT_OF_STOCK" ? "ACTIVE" : product.status === "ARCHIVED" ? "DRAFT" : product.status) as "DRAFT" | "ACTIVE" | "PAUSED",
      sku: product.sku,
      gtin: product.gtin ?? undefined,
      tags: product.tags,
      warrantyMonths: product.warrantyMonths,
      warrantyText: product.warrantyText,
      includedItems: product.includedItems,
      specifications: (product.specifications ?? []) as { group: string; items: { name: string; value: string }[] }[],
      weightGrams: product.weightGrams,
      heightCm: product.heightCm,
      widthCm: product.widthCm,
      lengthCm: product.lengthCm,
      freeShipping: product.freeShipping,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      isFeatured: product.isFeatured,
      attributes: product.attributes.map((a) => ({ attributeId: a.attributeId, value: a.value })),
      images: product.images.map((img) => ({ id: img.id, url: img.url, storageKey: img.storageKey, alt: img.alt, width: img.width, height: img.height })),
      options: product.options.map((o) => ({ name: o.name, values: o.values })),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        gtin: v.gtin ?? undefined,
        optionValues: (v.optionValues ?? {}) as Record<string, string>,
        priceCents: v.priceCents,
        compareAtPriceCents: v.compareAtPriceCents,
        costCents: v.costCents,
        stock: v.stock,
        stockBaseline: v.stock,
        minStock: v.minStock,
        weightGrams: v.weightGrams,
        imageIndex: v.imageId ? (imageIndexById.get(v.imageId) ?? null) : null,
        status: v.status,
      })),
    },
  };
}

/** Opções do editor: categorias (com profundidade), marcas e atributos por categoria. */
export async function getProductEditorOptions() {
  const [categories, brands, attributes] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.categoryAttribute.findMany({ orderBy: [{ position: "asc" }], select: { id: true, categoryId: true, name: true, key: true, type: true, options: true, unit: true, isRequired: true } }),
  ]);
  const children = new Map<string | null, typeof categories>();
  for (const c of categories) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c]);
  const flat: { id: string; name: string; depth: number; path: string }[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    for (const c of children.get(parentId) ?? []) {
      const path = prefix ? `${prefix} › ${c.name}` : c.name;
      flat.push({ id: c.id, name: c.name, depth, path });
      walk(c.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  // Atributos herdados: a categoria recebe os atributos dela e dos ancestrais.
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const attributesByCategory: Record<string, typeof attributes> = {};
  for (const c of categories) {
    const chain: string[] = [];
    let cur: string | null | undefined = c.id;
    let guard = 0;
    while (cur && guard++ < 10) {
      chain.push(cur);
      cur = parentOf.get(cur);
    }
    attributesByCategory[c.id] = attributes.filter((a) => chain.includes(a.categoryId));
  }
  return { categories: flat, brands, attributesByCategory };
}

export type ProductEditorOptions = Awaited<ReturnType<typeof getProductEditorOptions>>;
export type ProductEditData = Awaited<ReturnType<typeof getProductForEdit>>;
