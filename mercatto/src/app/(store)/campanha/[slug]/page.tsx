import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { parseSearchParams } from "@/features/search/schemas";
import { getCampaignPageData } from "@/features/storefront/pages.server";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { buildMetadata } from "@/features/seo/metadata";
import { Listing } from "@/features/search/components/listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Countdown } from "@/components/ui/countdown";
import { Alert } from "@/components/ui/alert";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCampaignPageData(slug, parseSearchParams({}));
  return data ? buildMetadata({ title: data.campaign.name, description: data.campaign.description, path: `/campanha/${slug}`, image: data.campaign.bannerUrl }) : { title: "Campanha" };
}

export default async function CampaignPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const filters = parseSearchParams(await searchParams);
  const [data, user] = await Promise.all([getCampaignPageData(slug, filters), getCurrentUser()]);
  if (!data) notFound();
  const favorites = user ? await getWishlistProductIds(user.id) : undefined;
  return (
    <div className="container-page flex flex-col gap-5 py-4 sm:py-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Campanhas" }, { label: data.campaign.name }]} />
      <section className="rounded-panel bg-brand-800 px-5 py-6 text-white sm:px-8">
        <p className="text-xs font-bold tracking-wider text-sun-300 uppercase">Campanha oficial</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{data.campaign.name}</h1>
        {data.campaign.description ? <p className="mt-1 max-w-2xl text-sm text-white/85">{data.campaign.description}</p> : null}
        {data.campaign.state === "ACTIVE" ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
            Termina em <Countdown endsAt={data.campaign.endsAt.toISOString()} className="text-fg" />
          </p>
        ) : null}
      </section>
      {data.campaign.state === "EXPIRED" ? <Alert tone="warning" title="Esta campanha foi encerrada">Os preços abaixo já não têm o desconto da campanha.</Alert> : null}
      {data.campaign.state === "SCHEDULED" ? <Alert tone="info" title="Em breve">A campanha ainda não começou. Volte na data de início.</Alert> : null}
      <Listing basePath={`/campanha/${slug}`} filters={filters} result={data.results} favorites={favorites} />
    </div>
  );
}
