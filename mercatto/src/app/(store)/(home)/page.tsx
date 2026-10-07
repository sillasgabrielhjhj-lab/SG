import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { after } from "next/server";
import { ArrowRight, BadgeCheck, Flame, Gift, Sparkles, Star, Store, ThumbsUp, TrendingUp, Truck, Wallet } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getHomePageData } from "@/features/home/queries";
import { getHeroSlides } from "@/features/home/hero.server";
import { getStoreBenefits } from "@/features/home/benefits.server";
import { getWelcomeCampaign } from "@/features/coupons/campaign.server";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { maybeSyncPromotions } from "@/features/promotions/sync.server";
import { getStoreSettings } from "@/features/settings/queries";
import { buildMetadata } from "@/features/seo/metadata";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/features/seo/jsonld";
import { HeroCarousel } from "@/features/home/components/hero-carousel";
import { BenefitsBar } from "@/features/home/components/benefits-bar";
import { CategoryShowcase } from "@/features/home/components/category-showcase";
import { FlashDeals } from "@/features/home/components/flash-deals";
import { PromoStrip } from "@/features/home/components/promo-strip";
import { RecommendedForYou } from "@/features/home/components/recommended-for-you";
import { RecentlyViewed } from "@/features/home/components/recently-viewed";
import { TrustSection } from "@/features/home/components/trust-section";
import { RevealObserver } from "@/components/motion/reveal-observer";
import { ProductRail } from "@/components/commerce/product-rail";
import { ProductGrid, SectionHeader } from "@/components/commerce/product-grid";
import { RatingStars } from "@/components/commerce/rating";
import { OfficialBadge } from "@/components/commerce/badges";
import { formatCompact } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { skipImageOptimization } from "@/lib/images";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return buildMetadata({
    title: settings.seoTitle ?? "Mercatto — compre com confiança",
    description: settings.seoDescription,
    path: "/",
  });
}

function paymentLabel(methods: string[]): string {
  const pix = methods.includes("PIX");
  const card = methods.includes("CREDIT_CARD");
  if (pix && card) return "PIX e cartões de crédito.";
  if (card) return "Cartões de crédito, com parcelamento.";
  if (pix) return "PIX com aprovação na hora.";
  return "Pagamento seguro no checkout.";
}

/**
 * Home: entrada progressiva (header → busca → hero → benefícios → categorias)
 * e revelação ao rolar nas demais seções. Toda seção é opcional — só aparece
 * com dados reais, e nenhum produto se repete entre vitrines.
 */
export default async function HomePage() {
  after(maybeSyncPromotions);
  const [data, user, settings, welcome, benefits] = await Promise.all([getHomePageData(), getCurrentUser(), getStoreSettings(), getCurrentUser().then((u) => getWelcomeCampaign(u?.id ?? null)), getStoreBenefits()]);
  const [slides, favoriteSet] = await Promise.all([getHeroSlides(welcome), user ? getWishlistProductIds(user.id) : Promise.resolve(new Set<string>())]);
  const favorites = [...favoriteSet];
  const social = Object.values((settings.socialLinks as Record<string, string | null> | null) ?? {}).filter((v): v is string => Boolean(v));
  const hasDeals = data.dayDeals.length > 0 || Boolean(data.flash?.products.length);

  return (
    <div className="container-page flex flex-col gap-8 pt-4 sm:gap-10 sm:pt-6">
      <JsonLd data={[organizationJsonLd({ name: settings.storeName, sameAs: social, email: settings.contactEmail, phone: settings.contactPhone }), websiteJsonLd()]} />
      <h1 className="sr-only">Mercatto — ofertas oficiais e lojas parceiras</h1>

      <div className="flex flex-col gap-4 sm:gap-5">
        <HeroCarousel slides={slides} />
        <BenefitsBar items={benefits.items} />
      </div>

      <CategoryShowcase categories={data.categories} />

      <FlashDeals flash={data.flash} favorites={favorites} />

      {data.mode === "showcase" && data.showcase.length ? (
        <section data-reveal aria-labelledby="showcase-title">
          <SectionHeader id="showcase-title" title="Produtos em destaque" subtitle="Seleção da Mercatto para você" icon={<Sparkles />} />
          <ProductGrid products={data.showcase} favorites={favoriteSet} listName="Produtos em destaque" priorityCount={2} />
        </section>
      ) : null}

      {data.dayDeals.length ? (
        <section data-reveal aria-labelledby="deals-title">
          <SectionHeader id="deals-title" title="Ofertas do dia" subtitle="Descontos selecionados para você" href="/ofertas" icon={<Flame />} />
          <ProductRail products={data.dayDeals} label="Ofertas do dia" favorites={favorites} />
        </section>
      ) : null}

      {/* Banner promocional: campanhas do painel; sem elas, uma faixa verdadeira. */}
      {data.banners.mid.length ? (
        <section data-reveal aria-label="Campanhas" className="grid gap-3 md:grid-cols-2">
          {data.banners.mid.map((b) => (
            <Link key={b.id} href={b.link} className="hover-lift group relative flex h-36 overflow-hidden rounded-panel bg-brand-50 focus-ring sm:h-44">
              {b.imageUrl ? <Image src={b.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 640px" unoptimized={skipImageOptimization(b.imageUrl)} className="object-cover object-right transition-transform duration-700 ease-out-soft motion-safe:group-hover:scale-[1.03]" /> : null}
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
      ) : hasDeals ? (
        <PromoStrip title="Ofertas que valem o clique." subtitle="Descontos reais, atualizados todos os dias." cta="Ver ofertas" href="/ofertas" icon={<Flame />} tone="sun" />
      ) : (
        <PromoStrip title="Achou. Gostou. É Mercatto." subtitle="Produtos originais, pagamento protegido e entrega acompanhada." cta="Explorar categorias" href="/categorias" icon={<Sparkles />} tone="light" />
      )}

      {data.official.length ? (
        <section data-reveal aria-labelledby="official-title" className="relative overflow-hidden rounded-panel bg-brand-800 p-4 sm:p-5">
          <span aria-hidden className="absolute -top-24 -right-16 size-72 rounded-full bg-brand-700/50" />
          <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <OfficialBadge className="bg-white/15" />
              <h2 id="official-title" className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                Oficial Mercatto
              </h2>
              <p className="text-sm text-white/80">Vendido e entregue pela Mercatto{settings.freeShippingThresholdCents ? ` · frete grátis acima de ${formatBRL(settings.freeShippingThresholdCents)}` : ""}.</p>
            </div>
            <Link href="/oficial" className="group inline-flex items-center gap-1 text-sm font-bold text-sun-300 hover:underline focus-ring">
              Ir para a loja oficial <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <ProductRail products={data.official} label="Oficial Mercatto" favorites={favorites} className="relative" />
        </section>
      ) : null}

      {data.bestSellers.length ? (
        <section data-reveal aria-labelledby="best-title">
          <SectionHeader id="best-title" title="Mais vendidos" subtitle="Ranking pelas vendas reais da loja" href="/buscar?ordenar=mais_vendidos" icon={<TrendingUp />} />
          <ProductGrid products={data.bestSellers} favorites={favoriteSet} listName="Mais vendidos" ranked />
        </section>
      ) : null}

      <RecommendedForYou initial={data.recommended} exclude={data.shownIds} favorites={favorites} />

      {welcome ? (
        <PromoStrip
          title={welcome.firstPurchaseOnly ? `${welcome.headline} ${welcome.scopeLabel}.` : welcome.percent ? `Até ${welcome.percent}% OFF ${welcome.scopeLabel}.` : `${welcome.headline} ${welcome.scopeLabel}.`}
          subtitle="Use o cupom no carrinho. Confira os produtos participantes."
          cta="Ver participantes"
          href={welcome.href}
          icon={<Gift />}
          aside={<span className="hidden rounded-full border-2 border-dashed border-sun-300 px-3 py-1 font-mono text-sm font-extrabold tracking-widest text-sun-300 sm:inline">{welcome.code}</span>}
        />
      ) : data.banners.strip[0] ? (
        <PromoStrip title={data.banners.strip[0].title} subtitle={data.banners.strip[0].subtitle ?? undefined} cta={data.banners.strip[0].ctaLabel ?? "Saiba mais"} href={data.banners.strip[0].link} icon={<BadgeCheck />} tone="light" />
      ) : null}

      {data.brands.length ? (
        <section data-reveal aria-labelledby="brands-title">
          <SectionHeader id="brands-title" title="Marcas" icon={<Star />} />
          <ul data-stagger className="flex flex-wrap gap-2">
            {data.brands.map((b, i) => (
              <li key={b.id} style={{ "--i": i } as CSSProperties}>
                <Link href={`/marca/${b.slug}`} className="press inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-bold text-fg-muted shadow-card transition-[color,border-color,box-shadow] hover:border-brand-400 hover:text-brand-800 hover:shadow-raised focus-ring">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.freeShipping.length ? (
        <section data-reveal aria-labelledby="free-title">
          <SectionHeader id="free-title" title="Frete grátis" subtitle="Receba sem pagar a entrega" href="/buscar?frete_gratis=1" icon={<Truck />} />
          <ProductRail products={data.freeShipping} label="Frete grátis" favorites={favorites} />
        </section>
      ) : null}

      {data.priceBands.length ? (
        <section data-reveal aria-labelledby="price-title">
          <SectionHeader id="price-title" title="Compre por preço" icon={<Wallet />} />
          <ul data-stagger className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:gap-3">
            {data.priceBands.map((b, i) => (
              <li key={b.maxCents} style={{ "--i": i } as CSSProperties}>
                <Link href={`/buscar?preco_max=${b.maxCents / 100}`} className="group flex items-center justify-between gap-2 rounded-card border border-line bg-surface px-4 py-3 transition-[transform,translate,scale,box-shadow,border-color] duration-(--motion-base) ease-enter hover:border-brand-300 focus-ring active:scale-[0.99] [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-card">
                  <span>
                    <span className="block text-xs font-semibold text-fg-muted">Até</span>
                    <span className="block text-lg font-extrabold text-brand-800 tabular">{formatBRL(b.maxCents).replace(",00", "")}</span>
                  </span>
                  <span className="text-xs text-fg-muted">{b.count} produtos</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.newArrivals.length ? (
        <section data-reveal aria-labelledby="new-title">
          <SectionHeader id="new-title" title="Novidades" subtitle="Lançamentos recentes na loja" href="/buscar?ordenar=novidades" icon={<Sparkles />} />
          <ProductRail products={data.newArrivals} label="Novidades" favorites={favorites} />
        </section>
      ) : null}

      {data.topRated.length ? (
        <section data-reveal aria-labelledby="top-title">
          <SectionHeader id="top-title" title="Melhor avaliados" subtitle="Notas de quem comprou" href="/buscar?ordenar=melhor_avaliados" icon={<ThumbsUp />} />
          <ProductRail products={data.topRated} label="Melhor avaliados" favorites={favorites} />
        </section>
      ) : null}

      <RecentlyViewed />

      {data.featuredStores.length > 1 ? (
        <section data-reveal aria-labelledby="stores-title">
          <SectionHeader id="stores-title" title="Lojas em destaque" icon={<Store />} />
          <ul data-stagger className="-mx-4 flex gap-3 overflow-x-auto px-4 py-1.5 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {data.featuredStores.map((s, i) => (
              <li key={s.id} style={{ "--i": i } as CSSProperties} className="w-56 shrink-0 sm:w-auto">
                <Link href={s.isOfficial ? "/oficial" : `/loja/${s.slug}`} className="hover-lift flex h-full flex-col items-center gap-2 rounded-card border border-line bg-surface p-4 text-center focus-ring">
                  <span className={`grid size-14 place-items-center rounded-full text-lg font-extrabold ${s.isOfficial ? "bg-brand-800 text-white" : "bg-brand-50 text-brand-800"}`}>{s.name.slice(0, 1)}</span>
                  <span className="line-clamp-1 text-sm font-semibold text-fg">{s.name}</span>
                  {s.isOfficial ? <OfficialBadge compact /> : null}
                  {s.ratingCount > 0 ? <RatingStars value={s.ratingAvg} count={s.ratingCount} size="xs" /> : <span className="text-xs text-fg-subtle">Nova loja</span>}
                  <span className="text-xs text-fg-muted">
                    {s._count.products} produtos{s.salesCount > 0 ? ` · +${formatCompact(s.salesCount)} vendas` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TrustSection paymentLabel={paymentLabel(benefits.methods)} />
      <RevealObserver />
    </div>
  );
}
