import Link from "next/link";
import { Heart, Store } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listFavoriteStores, listWishlistProductIds } from "@/features/account/service";
import { getProductCardsByIds } from "@/features/catalog/cards.server";
import { ProductGrid } from "@/components/commerce/product-grid";
import { RatingStars } from "@/components/commerce/rating";
import { OfficialBadge } from "@/components/commerce/badges";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Favoritos" };

export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const user = await requireUserPage("/minha-conta/favoritos");
  const page = Math.max(1, Number((await searchParams).pagina) || 1);
  const [{ productIds, total, totalPages }, stores] = await Promise.all([listWishlistProductIds(user.id, page), listFavoriteStores(user.id)]);
  const products = await getProductCardsByIds(productIds, { preserveOrder: true, includeOutOfStock: true });
  const favorites = new Set(productIds);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <PageHeading title="Favoritos" description={total ? `${total} produto(s) salvos` : undefined} />
        {products.length === 0 ? (
          <div className="rounded-card border border-line bg-surface">
            <EmptyState icon={<Heart />} title="Seus achados favoritos moram aqui." description="Toque no coração dos produtos para salvá-los e acompanhar preço e estoque." action={<ButtonLink href="/ofertas">Explorar ofertas</ButtonLink>} />
          </div>
        ) : (
          <>
            <ProductGrid products={products} favorites={favorites} columns="default" />
            <Pagination className="mt-6" page={page} totalPages={totalPages} buildHref={(p) => `/minha-conta/favoritos${p > 1 ? `?pagina=${p}` : ""}`} />
          </>
        )}
      </section>

      <section aria-labelledby="fav-stores">
        <h2 id="fav-stores" className="mb-3 text-lg font-bold">
          Lojas que você segue
        </h2>
        {stores.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-4 text-sm text-fg-muted">
            <Store className="mr-1.5 inline size-4 align-[-3px] text-brand-700" aria-hidden />
            Siga lojas para encontrá-las rapidamente aqui.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stores.map(({ store }) => (
              <li key={store.id}>
                <Link href={store.isOfficial ? "/oficial" : `/loja/${store.slug}`} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 hover:shadow-raised focus-ring">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-full text-lg font-extrabold ${store.isOfficial ? "bg-brand-800 text-white" : "bg-brand-50 text-brand-800"}`}>{store.name.slice(0, 1)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{store.name}</span>
                    {store.isOfficial ? <OfficialBadge compact /> : store.ratingCount ? <RatingStars value={store.ratingAvg} count={store.ratingCount} size="xs" /> : <span className="text-xs text-fg-subtle">Nova loja</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
