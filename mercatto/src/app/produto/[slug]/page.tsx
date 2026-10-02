import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Store, ShieldCheck } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getProductBySlug, getRelatedProducts } from "@/lib/data/catalog";
import { getCurrentUser } from "@/lib/auth/guards";
import { ProductGallery } from "@/components/product/product-gallery";
import { PurchaseBox } from "@/components/product/purchase-box";
import { ShippingEstimator } from "@/components/product/shipping-estimator";
import { ReviewSection } from "@/components/product/review-section";
import { QuestionSection } from "@/components/product/question-section";
import { ProductSection } from "@/components/home/product-section";
import { Badge } from "@/components/ui/badge";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, user] = await Promise.all([getProductBySlug(slug), getCurrentUser()]);

  if (!product) notFound();

  const related = await getRelatedProducts(product.categoryId, product.id);

  return (
    <>
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
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <PurchaseBox
                basePriceCents={product.priceCents}
                compareAtPriceCents={product.compareAtPriceCents}
                baseInventory={product.inventory}
                variants={product.variants}
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
                {product.seller.isVerified && (
                  <Badge variant="success">
                    <ShieldCheck className="size-3" /> Verificado
                  </Badge>
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
