import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { after } from "next/server";
import { BadgeCheck, Package, ShieldCheck, Star, Store } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getFrequentlyBoughtTogether, getProductPageData, getProductQuestions, getProductReviews, getRelatedProducts, getSimilarProducts, recordProductView, resolveProductSlug } from "@/features/product/queries";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { getStoreSettings } from "@/features/settings/queries";
import { effectiveInstallmentConfig } from "@/features/checkout/installments";
import { maybeSyncPromotions } from "@/features/promotions/sync.server";
import { buildMetadata } from "@/features/seo/metadata";
import { breadcrumbJsonLd, JsonLd, productJsonLd } from "@/features/seo/jsonld";
import { ProductPurchase } from "@/features/product/components/purchase";
import { ProductReviews } from "@/features/product/components/reviews";
import { ProductQuestions } from "@/features/product/components/questions";
import { RecentlyViewed, TrackRecentlyViewed } from "@/features/home/components/recently-viewed";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ProductRail } from "@/components/commerce/product-rail";
import { SectionHeader } from "@/components/commerce/product-grid";
import { RatingStars } from "@/components/commerce/rating";
import { OfficialBadge } from "@/components/commerce/badges";
import { formatCompact, formatMembership } from "@/lib/format";
import { truncate } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductPageData(slug);
  if (!product) {
    // Decidido aqui (antes do streaming para robôs): 301 para slugs antigos e 404 real.
    const redirect = await resolveProductSlug(slug);
    if (redirect) permanentRedirect(`/produto/${redirect.redirectTo}`);
    notFound();
  }
  return buildMetadata({
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? truncate(product.shortDescription ?? product.description, 160),
    path: `/produto/${product.slug}`,
    image: product.images[0]?.url,
    imageAlt: product.name,
  });
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-36 rounded-panel border border-line bg-surface p-4 sm:p-6">
      <h2 id={`${id}-title`} className="mb-4 text-lg font-bold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductPageData(slug);
  if (!product) {
    const redirect = await resolveProductSlug(slug);
    if (redirect) permanentRedirect(`/produto/${redirect.redirectTo}`);
    notFound();
  }
  after(() => recordProductView(product.id));
  after(maybeSyncPromotions);

  const [user, settings, reviews, questions, related, similar, together] = await Promise.all([
    getCurrentUser(),
    getStoreSettings(),
    getProductReviews(product.id),
    getProductQuestions(product.id),
    getRelatedProducts({ id: product.id, categoryId: product.categoryId, effectivePriceCents: product.effectivePriceCents }),
    getSimilarProducts({ id: product.id, brandId: product.brandId, storeId: product.storeId }),
    getFrequentlyBoughtTogether(product.id),
  ]);
  const favorites = user ? await getWishlistProductIds(user.id) : new Set<string>();
  const crumbs = [{ label: "Início", href: "/" }, ...product.breadcrumb.map((c) => ({ label: c.name, href: `/categoria/${c.slug}` })), { label: product.name }];
  const promoEnd = product.variants.map((v) => v.promotion?.endsAt).find(Boolean);

  return (
    <div className="container-page flex flex-col gap-6 py-4 sm:py-6">
      <JsonLd
        data={[
          productJsonLd({
            name: product.name,
            slug: product.slug,
            description: product.description,
            images: product.images.map((i) => i.url),
            sku: product.sku,
            gtin: product.isDemo ? null : product.gtin,
            brandName: product.brand?.name,
            condition: product.condition,
            sellerName: product.store.isOfficial ? "Mercatto" : product.store.name,
            offers: product.variants.map((v) => ({ sku: v.sku, priceCents: v.priceCents, inStock: v.stock > 0 && product.status === "ACTIVE", priceValidUntil: promoEnd ? new Date(promoEnd) : null })),
            realRating: product.realRating,
          }),
          breadcrumbJsonLd([{ name: "Início", path: "/" }, ...product.breadcrumb.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })), { name: product.name, path: `/produto/${product.slug}` }]),
        ]}
      />
      <TrackRecentlyViewed productId={product.id} />
      <Breadcrumbs items={crumbs} />

      <ProductPurchase product={product} favorited={favorites.has(product.id)} installmentConfig={effectiveInstallmentConfig(settings)} pixDiscountPercent={settings.pixDiscountPercent} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="descricao" title="Descrição">
            <p className="text-sm leading-relaxed whitespace-pre-line text-fg">{product.description}</p>
          </Section>

          {product.specifications.length || product.attributes.length ? (
            <Section id="ficha-tecnica" title="Características e ficha técnica">
              <div className="grid gap-5">
                {product.attributes.length ? (
                  <table className="w-full overflow-hidden rounded-md text-sm">
                    <caption className="mb-2 text-left text-sm font-semibold">Principais características</caption>
                    <tbody>
                      {product.attributes.map((a) => (
                        <tr key={a.name} className="odd:bg-surface-muted">
                          <th scope="row" className="w-2/5 px-3 py-2 text-left font-medium text-fg-muted">
                            {a.name}
                          </th>
                          <td className="px-3 py-2">{a.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {product.specifications.map((group) => (
                  <table key={group.group} className="w-full overflow-hidden rounded-md text-sm">
                    <caption className="mb-2 text-left text-sm font-semibold">{group.group}</caption>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.name} className="odd:bg-surface-muted">
                          <th scope="row" className="w-2/5 px-3 py-2 text-left font-medium text-fg-muted">
                            {item.name}
                          </th>
                          <td className="px-3 py-2">{item.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            </Section>
          ) : null}

          {product.warrantyText || product.includedItems.length ? (
            <Section id="garantia" title="Garantia e itens inclusos">
              <div className="grid gap-4 sm:grid-cols-2">
                {product.warrantyText ? (
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="size-4 text-brand-700" aria-hidden /> Garantia
                    </h3>
                    <p className="text-sm text-fg-muted">{product.warrantyText}</p>
                  </div>
                ) : null}
                {product.includedItems.length ? (
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      <Package className="size-4 text-brand-700" aria-hidden /> Na caixa
                    </h3>
                    <ul className="list-inside list-disc text-sm text-fg-muted">
                      {product.includedItems.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}

          <Section id="perguntas" title="Perguntas e respostas">
            <ProductQuestions productId={product.id} initial={questions} isLoggedIn={Boolean(user)} isOwner={user?.storeId === product.storeId} />
          </Section>

          <Section id="avaliacoes" title="Opiniões sobre o produto">
            <ProductReviews productId={product.id} ratingAvg={product.ratingAvg} distribution={product.reviews.distribution} total={product.reviews.total} withPhotos={product.reviews.withPhotos} initial={reviews} />
          </Section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-panel border border-line bg-surface p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Store className="size-4 text-brand-700" aria-hidden /> Informações do vendedor
            </h2>
            <p className="text-base font-bold">{product.store.isOfficial ? "Mercatto" : product.store.name}</p>
            {product.store.isOfficial ? <OfficialBadge className="mt-1" /> : <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-brand-700"><BadgeCheck className="size-3.5" aria-hidden /> Loja verificada</p>}
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-fg-subtle">Vendas</dt>
                <dd className="text-sm font-semibold">+{formatCompact(product.store.salesCount)}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Avaliação</dt>
                <dd className="text-sm font-semibold">{product.store.ratingCount ? <RatingStars value={product.store.ratingAvg} size="xs" showValue /> : "—"}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Cancelamentos</dt>
                <dd className="text-sm font-semibold">{(product.store.cancellationRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Tempo</dt>
                <dd className="text-sm font-semibold">{formatMembership(product.store.createdAt).replace(" na Mercatto", "")}</dd>
              </div>
            </dl>
            <Link href={product.store.isOfficial ? "/oficial" : `/loja/${product.store.slug}`} className="mt-4 block rounded-field border border-line-strong py-2 text-center text-sm font-semibold hover:border-brand-500 hover:text-brand-800 focus-ring">
              Ver produtos da loja
            </Link>
          </div>
          <div className="rounded-panel border border-line bg-surface p-4 text-sm">
            <h2 className="mb-2 flex items-center gap-2 font-bold">
              <Star className="size-4 text-brand-700" aria-hidden /> Compra protegida
            </h2>
            <p className="text-fg-muted">Seu pagamento fica protegido até você receber o pedido. Se algo der errado, devolvemos seu dinheiro.</p>
          </div>
        </aside>
      </div>

      {together.length ? (
        <section aria-labelledby="together-title">
          <SectionHeader id="together-title" title="Quem comprou também levou" />
          <ProductRail products={together} label="Comprados juntos" favorites={[...favorites]} />
        </section>
      ) : null}
      {related.length ? (
        <section aria-labelledby="related-title">
          <SectionHeader id="related-title" title="Produtos relacionados" href={`/categoria/${product.category.slug}`} />
          <ProductRail products={related} label="Produtos relacionados" favorites={[...favorites]} />
        </section>
      ) : null}
      {similar.length ? (
        <section aria-labelledby="similar-title">
          <SectionHeader id="similar-title" title={product.brand ? `Mais de ${product.brand.name} e da loja` : "Produtos similares"} />
          <ProductRail products={similar} label="Produtos similares" favorites={[...favorites]} />
        </section>
      ) : null}
      <RecentlyViewed excludeId={product.id} />
    </div>
  );
}
