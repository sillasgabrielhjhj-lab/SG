import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { parseSearchParams } from "@/features/search/schemas";
import { getStorePageData } from "@/features/storefront/pages.server";
import { getWishlistProductIds, isStoreFavorited } from "@/features/wishlist/queries";
import { buildMetadata } from "@/features/seo/metadata";
import { Listing } from "@/features/search/components/listing";
import { StoreHeader } from "@/features/storefront/store-header";
import { FollowStoreButton } from "@/features/storefront/follow-store-button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorePageData(slug, parseSearchParams({}));
  if (!data || "redirectTo" in data) return { title: "Loja" };
  return buildMetadata({ title: `${data.store.name} na Mercatto`, description: data.store.description, path: `/loja/${data.store.slug}` });
}

export default async function StorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const filters = parseSearchParams(await searchParams);
  const [data, user] = await Promise.all([getStorePageData(slug, filters), getCurrentUser()]);
  if (!data) notFound();
  if ("redirectTo" in data) permanentRedirect(`/loja/${data.redirectTo}`);
  if (data.store.isOfficial) redirect("/oficial");
  const [favorites, following] = user ? await Promise.all([getWishlistProductIds(user.id), isStoreFavorited(user.id, data.store.id)]) : [undefined, false];
  return (
    <div className="container-page flex flex-col gap-5 py-4 sm:py-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Lojas" }, { label: data.store.name }]} />
      <StoreHeader store={{ ...data.store, productCount: data.store._count.products }}>
        <FollowStoreButton storeId={data.store.id} initial={following} />
      </StoreHeader>
      <Listing basePath={`/loja/${data.store.slug}`} filters={filters} result={data.results} favorites={favorites} />
    </div>
  );
}
