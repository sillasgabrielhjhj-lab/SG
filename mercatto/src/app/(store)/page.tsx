import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { after } from "next/server";
import { ArrowRight, BadgeCheck, Flame, Sparkles, Star, Store, ThumbsUp, TrendingUp, Zap } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getHomePageData } from "@/features/home/queries";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { maybeSyncPromotions } from "@/features/promotions/sync.server";
import { getStoreSettings } from "@/features/settings/queries";
import { buildMetadata } from "@/features/seo/metadata";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/features/seo/jsonld";
import { HeroCarousel } from "@/features/home/components/hero-carousel";
import { RecentlyViewed } from "@/features/home/components/recently-viewed";
import { CategoryIcon } from "@/components/layout/category-icon";
import { ProductRail } from "@/components/commerce/product-rail";
import { ProductGrid, SectionHeader } from "@/components/commerce/product-grid";
import { RatingStars } from "@/components/commerce/rating";
import { OfficialBadge } from "@/components/commerce/badges";
import { Countdown } from "@/components/ui/countdown";
import { formatCompact } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return buildMetadata({
    title: settings.seoTitle ?? "Mercatto — compre com confiança",
    description: settings.seoDescription,
    path: "/",
  });
}

export default async function HomePage() {
  after(maybeSyncPromotions);
  const [data, user, settings] = await Promise.all([getHomePageData(), getCurrentUser(), getStoreSettings()]);
  const favorites = user ? [...(await getWishlistProductIds(user.id))] : [];
  const social = Object.values((settings.socialLinks as Record<string, string | null> | null) ?? {}).filter((v): v is string => Boolean(v));

  return (
    <div className="container-page flex flex-col gap-8 pt-4 sm:gap-10 sm:pt-6">
      <JsonLd data={[organizationJsonLd({ name: settings.storeName, sameAs: social, email: settings.contactEmail, phone: settings.contactPhone }), websiteJsonLd()]} />
      <h1 className="sr-only">Mercatto — ofertas oficiais e lojas parceiras</h1>

      {data.banners.hero.length ? (
        <HeroCarousel slides={data.banners.hero.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, eyebrow: b.eyebrow, ctaLabel: b.ctaLabel, link: b.link, imageUrl: b.imageUrl, theme: b.theme }))} />
      ) : null}

      {/* Categorias */}
      {data.categories.length ? (
        <section aria-labelledby="cat-title">
          <SectionHeader id="cat-title" title="Categorias" href="/categorias" linkLabel="Ver todas" />
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-6 sm:gap-3 sm:overflow-visible sm:px-0 lg:grid-cols-11">
            {data.categories.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link href={`/categoria/${c.slug}`} className="group flex w-[84px] flex-col items-center gap-2 rounded-card p-2 text-center focus-ring sm:w-auto">
                  <span className="grid size-16 place-items-center rounded-full border border-line bg-surface text-brand-700 shadow-card transition-all duration-200 group-hover:border-brand-300 group-hover:bg-brand-50 group-hover:shadow-raised motion-safe:group-hover:-translate-y-0.5">
                    <CategoryIcon name={c.icon} className="size-7" />
                  </span>
                  <span className="text-xs leading-tight font-medium text-fg group-hover:text-brand-800">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Oferta relâmpago */}
      {data.flash && data.flash.products.length ? (
        <section aria-labelledby="flash-title" className="overflow-hidden rounded-panel border border-sun-300 bg-gradient-to-b from-sun-100 to-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-sun-400 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <Zap className="size-6 text-sun-900" fill="currentColor" aria-hidden />
              <h2 id="flash-title" className="text-lg font-extrabold tracking-tight text-sun-900 sm:text-xl">
                Ofertas relâmpago
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-sun-900">
              <span>Termina em</span>
              <Countdown endsAt={data.flash.endsAt} />
            </div>
            <Link href="/ofertas" className="text-sm font-bold text-sun-900 underline-offset-4 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="p-3 sm:p-4">
            <ProductRail products={data.flash.products} label="Ofertas relâmpago" favorites={favorites} />
          </div>
        </section>
      ) : null}

      {data.dayDeals.length ? (
        <section aria-labelledby="deals-title">
          <SectionHeader id="deals-title" title="Ofertas do dia" subtitle="Os maiores descontos de hoje" href="/ofertas" icon={<Flame />} />
          <ProductRail products={data.dayDeals} label="Ofertas do dia" favorites={favorites} />
        </section>
      ) : null}

      {/* Oficiais Mercatto */}
      {data.official.length ? (
        <section aria-labelledby="official-title" className="rounded-panel bg-brand-800 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <OfficialBadge className="bg-white/15" />
              <h2 id="official-title" className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                Ofertas oficiais Mercatto
              </h2>
              <p className="text-sm text-white/80">Estoque próprio, entrega rápida e frete grátis acima de R$ 199.</p>
            </div>
            <Link href="/oficial" className="inline-flex items-center gap-1 text-sm font-bold text-sun-300 hover:underline">
              Ir para a loja oficial <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ProductRail products={data.official} label="Ofertas oficiais Mercatto" favorites={favorites} />
        </section>
      ) : null}

      {/* Banners intermediários */}
      {data.banners.mid.length ? (
        <section aria-label="Campanhas" className="grid gap-3 md:grid-cols-2">
          {data.banners.mid.map((b) => (
            <Link key={b.id} href={b.link} className="group relative flex h-36 overflow-hidden rounded-panel bg-brand-50 focus-ring sm:h-44">
              {b.imageUrl ? <Image src={b.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 640px" unoptimized className="object-cover object-right transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" /> : null}
              <div className={`relative z-[1] flex max-w-[55%] flex-col justify-center gap-1 p-5 ${b.theme === "ink" || b.theme === "brand" ? "text-white" : "text-brand-950"}`}>
                <h3 className="text-lg font-extrabold sm:text-xl">{b.title}</h3>
                {b.subtitle ? <p className="text-sm opacity-85">{b.subtitle}</p> : null}
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-bold">
                  {b.ctaLabel ?? "Confira"} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      {data.bestSellers.length ? (
        <section aria-labelledby="best-title">
          <SectionHeader id="best-title" title="Mais vendidos" href="/buscar?ordenar=mais_vendidos" icon={<TrendingUp />} />
          <ProductGrid products={data.bestSellers.slice(0, 10)} favorites={new Set(favorites)} />
        </section>
      ) : null}

      {data.banners.strip[0] ? (
        <Link href={data.banners.strip[0].link} className="flex flex-col items-center justify-between gap-2 rounded-panel bg-brand-50 px-5 py-4 text-center ring-1 ring-brand-200 ring-inset hover:bg-brand-100 focus-ring sm:flex-row sm:text-left">
          <span className="flex items-center gap-2 text-sm font-bold text-brand-900 sm:text-base">
            <BadgeCheck className="size-5 text-brand-700" aria-hidden /> {data.banners.strip[0].title}
          </span>
          <span className="text-sm font-bold text-brand-700">{data.banners.strip[0].ctaLabel ?? "Saiba mais"} →</span>
        </Link>
      ) : null}

      {data.recommended.length ? (
        <section aria-labelledby="rec-title">
          <SectionHeader id="rec-title" title="Recomendados para você" subtitle="Seleção bem avaliada nas categorias em alta" icon={<Sparkles />} />
          <ProductRail products={data.recommended} label="Recomendados" favorites={favorites} />
        </section>
      ) : null}

      <RecentlyViewed />

      {data.topRated.length ? (
        <section aria-labelledby="top-title">
          <SectionHeader id="top-title" title="Melhor avaliados" href="/buscar?ordenar=melhor_avaliados" icon={<ThumbsUp />} />
          <ProductRail products={data.topRated} label="Melhor avaliados" favorites={favorites} />
        </section>
      ) : null}

      {data.featuredStores.length ? (
        <section aria-labelledby="stores-title">
          <SectionHeader id="stores-title" title="Lojas em destaque" icon={<Store />} />
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {data.featuredStores.map((s) => (
              <li key={s.id} className="w-56 shrink-0 sm:w-auto">
                <Link href={s.isOfficial ? "/oficial" : `/loja/${s.slug}`} className="flex h-full flex-col items-center gap-2 rounded-card border border-line bg-surface p-4 text-center transition-shadow hover:shadow-raised focus-ring">
                  <span className={`grid size-14 place-items-center rounded-full text-lg font-extrabold ${s.isOfficial ? "bg-brand-800 text-white" : "bg-brand-50 text-brand-800"}`}>{s.name.slice(0, 1)}</span>
                  <span className="line-clamp-1 text-sm font-semibold text-fg">{s.name}</span>
                  {s.isOfficial ? <OfficialBadge compact /> : null}
                  {s.ratingCount > 0 ? <RatingStars value={s.ratingAvg} count={s.ratingCount} size="xs" /> : <span className="text-xs text-fg-subtle">Nova loja</span>}
                  <span className="text-xs text-fg-muted">
                    {s._count.products} produtos · +{formatCompact(s.salesCount)} vendas
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.brands.length ? (
        <section aria-labelledby="brands-title">
          <SectionHeader id="brands-title" title="Marcas" icon={<Star />} />
          <ul className="flex flex-wrap gap-2">
            {data.brands.map((b) => (
              <li key={b.id}>
                <Link href={`/marca/${b.slug}`} className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-fg-muted transition-colors hover:border-brand-400 hover:text-brand-800 focus-ring">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.newArrivals.length ? (
        <section aria-labelledby="new-title">
          <SectionHeader id="new-title" title="Novidades" href="/buscar?ordenar=novidades" icon={<Sparkles />} />
          <ProductRail products={data.newArrivals} label="Novidades" favorites={favorites} />
        </section>
      ) : null}
    </div>
  );
}
