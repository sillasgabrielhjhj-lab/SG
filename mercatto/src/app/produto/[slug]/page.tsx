import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Store, ShieldCheck, BadgeCheck } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getProductBySlug, getRelatedProducts, getReviewBreakdown } from "@/lib/data/catalog";
import { getCurrentUser } from "@/lib/auth/guards";
import { ProductGallery } from "@/components/product/product-gallery";
import { PurchaseBox } from "@/components/product/purchase-box";
import { ShippingEstimator } from "@/components/product/shipping-estimator";
import { ReviewSection } from "@/components/product/review-section";
import { QuestionSection } from "@/components/product/question-section";
import { ProductSection } from "@/components/home/product-section";
import { Badge } from "@/components/ui/badge";

type Props = { params: Promise<{ slug: string }> };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const description = product.description.slice(0, 160);
  const imageUrl = product.images[0] ? `${APP_URL}${product.images[0].url}` : undefined;

  return {
    title: product.name,
    description,
    alternates: { canonical: `${APP_URL}/produto/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      url: `${APP_URL}/produto/${product.slug}`,
      type: "website",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, user] = await Promise.all([getProductBySlug(slug), getCurrentUser()]);

  if (!product) notFound();

  const [related, reviewBreakdown] = await Promise.all([
    getRelatedProducts(product.categoryId, product.id),
    getReviewBreakdown(product.id),
  ]);

  const baseAvailable = product.inventory
    ? product.inventory.quantity - product.inventory.reserved > 0
    : product.variants.some((v) => v.inventory && v.inventory.quantity - v.inventory.reserved > 0);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.images.map((img) => `${APP_URL}${img.url}`),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    offers: {
      "@type": "Offer",
      url: `${APP_URL}/produto/${product.slug}`,
      priceCurrency: "BRL",
      price: (product.priceCents / 100).toFixed(2),
      availability: baseAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: product.seller.storeName },
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAvg.toFixed(1),
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Mercatto", item: APP_URL },
      ...(product.category.parent
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: product.category.parent.name,
              item: `${APP_URL}/categoria/${product.category.parent.slug}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: product.category.parent ? 3 : 2,
        name: product.category.name,
        item: `${APP_URL}/categoria/${product.category.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <Header />
      <main className="flex-1">
        <div className="container-page py-6">
          <nav className="mb-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">Mercatto</Link>
            {" / "}
            {product.category.parent && (
              <>
                <Link href={`/categoria/${product.category.parent.slug}`} className="hover:text-primary">
                  {product.category.parent.name}
                </Link>
                {" / "}
              </>
            )}
            <Link href={`/categoria/${product.category.slug}`} className="hover:text-primary">
              {product.category.name}
            </Link>
          </nav>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
            <div>
              <ProductGallery images={product.images} productName={product.name} />

              <div className="mt-6">
                {product.brand && (
                  <p className="text-sm text-muted-foreground">{product.brand.name}</p>
                )}
                <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                  {product.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <a href="#avaliacoes" className="hover:text-primary">
                    ★ {product.ratingAvg.toFixed(1)} ({product.ratingCount} avaliações)
                  </a>
                  <span>SKU: {product.sku}</span>
                  <span>{product.salesCount} vendidos</span>
                </div>
              </div>

              <div className="mt-6 hidden lg:block">
                <ShippingEstimator />
              </div>

              <div className="mt-8">
                <h2 className="font-display text-xl font-semibold text-foreground">Descrição</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              </div>

              {product.attributes.length > 0 && (
                <div className="mt-8">
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Características
                  </h2>
                  <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {product.attributes.map((attr) => (
                      <div key={attr.id} className="grid grid-cols-2 px-4 py-2.5 text-sm">
                        <dt className="text-muted-foreground">{attr.name}</dt>
                        <dd className="text-foreground">{attr.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="mt-10">
                <QuestionSection
                  productId={product.id}
                  productSlug={product.slug}
                  questions={product.questions}
                  isAuthenticated={Boolean(user)}
                />
              </div>

              <div className="mt-10">
                <ReviewSection
                  reviews={product.reviews}
                  ratingAvg={product.ratingAvg}
                  ratingCount={product.ratingCount}
                  breakdown={reviewBreakdown}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <PurchaseBox
                productId={product.id}
                productSlug={product.slug}
                basePriceCents={product.priceCents}
                compareAtPriceCents={product.compareAtPriceCents}
                promotionStartsAt={product.promotionStartsAt}
                promotionEndsAt={product.promotionEndsAt}
                baseInventory={product.inventory}
                variants={product.variants}
                isAuthenticated={Boolean(user)}
              />

              <div className="lg:hidden">
                <ShippingEstimator />
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-border p-4">
                <Store className="size-8 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {product.seller.storeName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {product.seller.ratingAvg.toFixed(1)} ★ · {product.seller.ratingCount} avaliações
                  </p>
                </div>
                {product.seller.isOfficialStore ? (
                  <Badge variant="default">
                    <BadgeCheck className="size-3" /> Loja oficial
                  </Badge>
                ) : (
                  product.seller.isVerified && (
                    <Badge variant="success">
                      <ShieldCheck className="size-3" /> Verificado
                    </Badge>
                  )
                )}
              </div>

              <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                Compra protegida: reembolso garantido se o produto não chegar ou vier com defeito.
              </p>
            </div>
          </div>

          {related.length > 0 && (
            <div className="mt-14">
              <ProductSection
                title="Produtos relacionados"
                seeAllHref={`/categoria/${product.category.slug}`}
                products={related}
              />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
