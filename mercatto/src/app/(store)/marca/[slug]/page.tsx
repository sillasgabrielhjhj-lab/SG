import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { parseSearchParams } from "@/features/search/schemas";
import { getBrandPageData } from "@/features/storefront/pages.server";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { buildMetadata } from "@/features/seo/metadata";
import { Listing } from "@/features/search/components/listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBrandPageData(slug, parseSearchParams({}));
  return data ? buildMetadata({ title: `${data.brand.name}: produtos e ofertas`, path: `/marca/${slug}` }) : { title: "Marca" };
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const filters = parseSearchParams(await searchParams);
  const [data, user] = await Promise.all([getBrandPageData(slug, filters), getCurrentUser()]);
  if (!data) notFound();
  const favorites = user ? await getWishlistProductIds(user.id) : undefined;
  return (
    <div className="container-page py-4 sm:py-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Marcas" }, { label: data.brand.name }]} />
      <h1 className="mt-2 mb-4 text-xl font-bold tracking-tight sm:text-2xl">{data.brand.name}</h1>
      <Listing basePath={`/marca/${slug}`} filters={filters} result={data.results} favorites={favorites} />
    </div>
  );
}
