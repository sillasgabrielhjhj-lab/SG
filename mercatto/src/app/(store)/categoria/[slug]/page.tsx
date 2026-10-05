import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { after } from "next/server";
import { getCurrentUser } from "@/server/auth/guards";
import { parseSearchParams } from "@/features/search/schemas";
import { getCategoryPageData } from "@/features/storefront/pages.server";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { maybeSyncPromotions } from "@/features/promotions/sync.server";
import { buildMetadata } from "@/features/seo/metadata";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo/jsonld";
import { Listing } from "@/features/search/components/listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CategoryIcon } from "@/components/layout/category-icon";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await getCategoryPageData(slug, parseSearchParams(sp));
  if (!data || "redirectTo" in data) return { title: "Categoria" };
  const filtered = Object.keys(sp).some((k) => k !== "pagina");
  return buildMetadata({
    title: data.category.seoTitle ?? `${data.category.name}: ofertas e preços`,
    description: data.category.seoDescription ?? data.category.description ?? `Compre ${data.category.name} com frete grátis, PIX e parcelamento na Mercatto.`,
    path: `/categoria/${data.category.slug}`,
    noindex: filtered,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  after(maybeSyncPromotions);
  const { slug } = await params;
  const filters = parseSearchParams(await searchParams);
  const [data, user] = await Promise.all([getCategoryPageData(slug, filters), getCurrentUser()]);
  if (!data) notFound();
  if ("redirectTo" in data) permanentRedirect(`/categoria/${data.redirectTo}`);
  const favorites = user ? await getWishlistProductIds(user.id) : undefined;
  const crumbs = [{ label: "Início", href: "/" }, ...data.breadcrumb.map((c) => ({ label: c.name, href: `/categoria/${c.slug}` }))];
  return (
    <div className="container-page py-4 sm:py-6">
      <JsonLd data={breadcrumbJsonLd([{ name: "Início", path: "/" }, ...data.breadcrumb.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` }))])} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-2 mb-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700">
          <CategoryIcon name={data.category.icon} className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{data.category.name}</h1>
          {data.category.description ? <p className="text-sm text-fg-muted">{data.category.description}</p> : null}
        </div>
      </div>
      {data.children.length ? (
        <nav aria-label="Subcategorias" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
          {data.children.map((c) => (
            <Link key={c.id} href={`/categoria/${c.slug}`} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium hover:border-brand-400 hover:text-brand-800 focus-ring">
              <CategoryIcon name={c.icon} className="size-4 text-brand-700" />
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}
      <Listing basePath={`/categoria/${data.category.slug}`} filters={{ ...filters, category: data.category.slug }} result={data.results} favorites={favorites} hideCategoryFilter />
    </div>
  );
}
