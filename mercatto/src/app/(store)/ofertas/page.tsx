import type { Metadata } from "next";
import { after } from "next/server";
import { Zap } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { parseSearchParams } from "@/features/search/schemas";
import { getOffersPageData } from "@/features/storefront/pages.server";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { maybeSyncPromotions } from "@/features/promotions/sync.server";
import { buildMetadata } from "@/features/seo/metadata";
import { Listing } from "@/features/search/components/listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Countdown } from "@/components/ui/countdown";
import { ProductRail } from "@/components/commerce/product-rail";
import { formatDateTime } from "@/lib/format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = buildMetadata({ title: "Ofertas do dia e relâmpago", description: "Os maiores descontos da Mercatto: ofertas relâmpago, promoções oficiais e de lojas parceiras.", path: "/ofertas" });

export default async function OffersPage({ searchParams }: Props) {
  after(maybeSyncPromotions);
  const filters = parseSearchParams(await searchParams);
  const [data, user] = await Promise.all([getOffersPageData(filters), getCurrentUser()]);
  const favorites = user ? await getWishlistProductIds(user.id) : undefined;
  return (
    <div className="container-page flex flex-col gap-6 py-4 sm:py-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Ofertas" }]} />
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Ofertas do dia</h1>
      {data.flash && data.flash.products.length ? (
        <section aria-labelledby="flash-offers" className="overflow-hidden rounded-panel border border-sun-300 bg-sun-50">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-sun-400 px-4 py-3">
            <h2 id="flash-offers" className="flex items-center gap-2 text-lg font-extrabold text-sun-900">
              <Zap className="size-5" fill="currentColor" aria-hidden /> Relâmpago agora
            </h2>
            <span className="flex items-center gap-2 text-sm font-semibold text-sun-900">
              Termina em <Countdown endsAt={data.flash.endsAt} />
            </span>
          </div>
          <div className="p-3 sm:p-4">
            <ProductRail products={data.flash.products} label="Ofertas relâmpago" favorites={favorites ? [...favorites] : []} />
          </div>
          {data.flash.next ? <p className="border-t border-sun-200 px-4 py-2 text-xs font-semibold text-sun-800">Próxima relâmpago: {data.flash.next.name.replace("[DEMO] ", "")} — começa {formatDateTime(data.flash.next.startsAt)}</p> : null}
        </section>
      ) : null}
      <Listing basePath="/ofertas" filters={filters} result={data.results} favorites={favorites} />
    </div>
  );
}
