import type { Metadata } from "next";
import { after } from "next/server";
import { getCurrentUser } from "@/server/auth/guards";
import { parseSearchParams } from "@/features/search/schemas";
import { getOfficialStoreData } from "@/features/storefront/pages.server";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { maybeSyncPromotions } from "@/features/promotions/sync.server";
import { buildMetadata } from "@/features/seo/metadata";
import { Listing } from "@/features/search/components/listing";
import { StoreHeader } from "@/features/storefront/store-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = buildMetadata({ title: "Loja Oficial Mercatto", description: "Produtos vendidos e entregues pela Mercatto: estoque próprio, entrega rápida e garantia.", path: "/oficial" });

export default async function OfficialStorePage({ searchParams }: Props) {
  after(maybeSyncPromotions);
  const filters = parseSearchParams(await searchParams);
  const [data, user] = await Promise.all([getOfficialStoreData(filters), getCurrentUser()]);
  const favorites = user ? await getWishlistProductIds(user.id) : undefined;
  return (
    <div className="container-page flex flex-col gap-5 py-4 sm:py-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Oficial Mercatto" }]} />
      <StoreHeader
        store={{
          name: "Loja Oficial Mercatto",
          description: "Estoque próprio Mercatto: vendido e entregue por nós, com frete grátis acima de R$ 199 e troca facilitada.",
          isOfficial: true,
          ratingAvg: data.store?.ratingAvg ?? 0,
          ratingCount: data.store?.ratingCount ?? 0,
          salesCount: data.store?.salesCount ?? 0,
          cancellationRate: 0,
          createdAt: new Date("2024-01-01"),
          productCount: data.results.total,
        }}
      />
      <Listing basePath="/oficial" filters={filters} result={data.results} favorites={favorites} />
    </div>
  );
}
