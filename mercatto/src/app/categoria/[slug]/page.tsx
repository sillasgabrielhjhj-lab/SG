import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  getCategoryBySlug,
  getCategoryIdsForListing,
  getBrandsForFilter,
  queryProducts,
} from "@/lib/data/catalog";
import { parseCatalogSearchParams, type RawSearchParams } from "@/lib/data/parse-filters";
import { CatalogToolbar, CatalogFiltersSidebar } from "@/components/catalog/catalog-filters";
import { ProductGrid } from "@/components/catalog/product-grid";
import { CatalogPagination } from "@/components/catalog/pagination";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  return { title: category.name };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const categoryIds = await getCategoryIdsForListing(category.id);
  const filters = parseCatalogSearchParams(resolvedSearchParams);
  const [brands, result] = await Promise.all([
    getBrandsForFilter(categoryIds),
    queryProducts({ ...filters, categoryIds }),
  ]);

  const basePath = `/categoria/${slug}`;

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container-page py-6">
          <nav className="mb-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">Mercatto</Link>
            {category.parent && (
              <>
                {" / "}
                <Link href={`/categoria/${category.parent.slug}`} className="hover:text-primary">
                  {category.parent.name}
                </Link>
              </>
            )}
            {" / "}
            <span className="text-foreground">{category.name}</span>
          </nav>

          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            {category.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "produto encontrado" : "produtos encontrados"}
          </p>

          {category.children.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/categoria/${child.slug}`}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-8">
            <CatalogFiltersSidebar basePath={basePath} brands={brands} />

            <div className="flex-1">
              <CatalogToolbar basePath={basePath} brands={brands} />
              <div className="mt-5">
                <ProductGrid products={result.items} />
              </div>
              <CatalogPagination
                basePath={basePath}
                searchParams={resolvedSearchParams}
                page={result.page}
                pageCount={result.pageCount}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
