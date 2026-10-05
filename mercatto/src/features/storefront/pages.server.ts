import "server-only";
import { db } from "@/server/db";
import { getCategoryBreadcrumb, getCategoryTree } from "@/features/catalog/categories.server";
import { searchProducts } from "@/features/search/service";
import type { SearchFilters } from "@/features/search/schemas";
import { getFlashDeal } from "@/features/home/queries";

/** Página de categoria: dados + subcategorias + resultados (categoria fixa). */
export async function getCategoryPageData(slug: string, filters: SearchFilters) {
  const category = await db.category.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, slug: true, description: true, seoTitle: true, seoDescription: true, icon: true, imageUrl: true, parentId: true } });
  if (!category) {
    const redirect = await db.slugRedirect.findUnique({ where: { entity_fromSlug: { entity: "CATEGORY", fromSlug: slug } }, select: { toSlug: true } });
    return redirect ? { redirectTo: redirect.toSlug } : null;
  }
  const [breadcrumb, children, results] = await Promise.all([
    getCategoryBreadcrumb(category.id),
    db.category.findMany({ where: { parentId: category.id, isActive: true }, orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, icon: true } }),
    searchProducts({ ...filters, category: category.slug }, { basePath: `/categoria/${category.slug}` }),
  ]);
  return { category, breadcrumb, children, results };
}

export async function getBrandPageData(slug: string, filters: SearchFilters) {
  const brand = await db.brand.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, logoUrl: true } });
  if (!brand) return null;
  const results = await searchProducts({ ...filters, brands: [] }, { basePath: `/marca/${brand.slug}`, fixed: { brandId: brand.id } });
  return { brand, results };
}

export async function getStorePageData(slug: string, filters: SearchFilters) {
  const store = await db.store.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, description: true, logoUrl: true, bannerUrl: true, isOfficial: true, status: true, ratingAvg: true, ratingCount: true, salesCount: true, cancelledCount: true, createdAt: true, originCity: true, originState: true, _count: { select: { products: { where: { status: "ACTIVE" } }, favoritedBy: true } } },
  });
  if (!store || store.status !== "ACTIVE") {
    if (!store) {
      const redirect = await db.slugRedirect.findUnique({ where: { entity_fromSlug: { entity: "STORE", fromSlug: slug } }, select: { toSlug: true } });
      if (redirect) return { redirectTo: redirect.toSlug };
    }
    return null;
  }
  const results = await searchProducts({ ...filters, store: undefined }, { basePath: `/loja/${store.slug}`, fixed: { storeId: store.id } });
  const totalOrders = store.salesCount + store.cancelledCount;
  return { store: { ...store, cancellationRate: totalOrders ? store.cancelledCount / totalOrders : 0 }, results };
}

export async function getOfficialStoreData(filters: SearchFilters) {
  const store = await db.store.findFirst({ where: { isOfficial: true, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, slug: true, ratingAvg: true, ratingCount: true, salesCount: true } });
  const results = await searchProducts({ ...filters, official: false }, { basePath: "/oficial", fixed: { store: { isOfficial: true } } });
  return { store, results };
}

export async function getOffersPageData(filters: SearchFilters) {
  const [flash, results] = await Promise.all([
    getFlashDeal(),
    searchProducts({ ...filters, sort: filters.sort === "mais_vendidos" ? "maior_desconto" : filters.sort }, { basePath: "/ofertas", fixed: { OR: [{ hasActivePromotion: true }, { discountPercent: { gt: 0 } }] } }),
  ]);
  return { flash, results };
}

export async function getCampaignPageData(slug: string, filters: SearchFilters) {
  const now = new Date();
  const campaign = await db.campaign.findUnique({ where: { slug }, include: { promotions: { where: { status: { not: "CANCELLED" } }, select: { id: true, categoryIds: true, items: { select: { productId: true } } } } } });
  if (!campaign || !campaign.isActive) return null;
  const productIds = [...new Set(campaign.promotions.flatMap((p) => p.items.map((i) => i.productId)))];
  const categoryIds = [...new Set(campaign.promotions.flatMap((p) => p.categoryIds))];
  const results = await searchProducts(filters, { basePath: `/campanha/${campaign.slug}`, fixed: { OR: [{ id: { in: productIds } }, ...(categoryIds.length ? [{ categoryId: { in: categoryIds } }] : [])] } });
  const state = now < campaign.startsAt ? "SCHEDULED" : now >= campaign.endsAt ? "EXPIRED" : "ACTIVE";
  return { campaign: { ...campaign, state }, results };
}

/** Índice de todas as categorias (página /categorias). */
export async function getAllCategoriesForIndex() {
  return getCategoryTree();
}
