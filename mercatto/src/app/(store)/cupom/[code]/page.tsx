import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Gift, SearchX, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getCouponLanding } from "@/features/coupons/campaign.server";
import { CouponTicket } from "@/features/coupons/components/coupon-ticket";
import { ActivateCouponButton } from "@/features/coupons/components/activate-coupon-button";
import { getWishlistProductIds } from "@/features/wishlist/queries";
import { buildMetadata } from "@/features/seo/metadata";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { ProductGrid, SectionHeader } from "@/components/commerce/product-grid";
import { formatDate } from "@/lib/format";

type Props = { params: Promise<{ code: string }> };


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const data = await getCouponLanding(decodeURIComponent(code));
  if (!data) return buildMetadata({ title: "Cupom não encontrado", path: `/cupom/${code}`, noindex: true });
  return buildMetadata({
    title: `Cupom ${data.campaign.code}: ${data.campaign.headline} ${data.campaign.scopeLabel}`,
    description: `Use o cupom ${data.campaign.code} e ganhe ${data.campaign.benefit} ${data.campaign.restricted ? "nos produtos participantes" : "nas compras"} da Mercatto. Confira as condições.`,
    path: `/cupom/${data.campaign.code}`,
    // Cupons expiram: a página não deve ficar indexada com uma oferta antiga.
    noindex: true,
  });
}

export default async function CouponPage({ params }: Props) {
  const { code } = await params;
  const [data, user] = await Promise.all([getCouponLanding(decodeURIComponent(code)), getCurrentUser()]);
  if (!data) notFound();
  const { campaign, status, startsAt, products, total } = data;
  const live = status === "live";
  const favorites = user ? await getWishlistProductIds(user.id) : undefined;

  return (
    <div className="container-page flex flex-col gap-6 py-4 sm:py-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Ofertas", href: "/ofertas" }, { label: `Cupom ${campaign.code}` }]} />

      <section aria-labelledby="coupon-title" className="relative grid animate-fade-up gap-5 overflow-hidden rounded-banner bg-brand-800 p-5 text-white sm:p-8 md:grid-cols-[1.2fr_1fr] md:items-center">
        <span aria-hidden className="absolute -top-24 -right-16 size-72 rounded-full bg-brand-700/60" />
        <span aria-hidden className="absolute -bottom-28 left-1/3 size-60 rounded-full bg-brand-900/60" />
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-sun-300 uppercase">
            <Gift className="size-3.5" aria-hidden /> Cupom de desconto
          </p>
          <h1 id="coupon-title" className="mt-3 text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">
            {campaign.headline}
            <span className="mt-2 block text-lg font-semibold text-white/85 sm:text-xl">{campaign.scopeLabel}</span>
          </h1>
          {campaign.endsAt && live ? <p className="mt-3 text-sm text-white/80">Válido até {formatDate(new Date(new Date(campaign.endsAt).getTime() - 1))}.</p> : null}
        </div>
        <div className="relative flex flex-col gap-3 rounded-panel bg-surface p-4 text-fg shadow-popover">
          <CouponTicket code={campaign.code} source="coupon_page" />
          {live ? (
            <ActivateCouponButton code={campaign.code} />
          ) : status === "scheduled" && startsAt ? (
            <p className="rounded-field bg-info-50 px-3 py-2 text-sm font-semibold text-info-700">Disponível a partir de {formatDate(new Date(startsAt))}.</p>
          ) : (
            <p className="rounded-field bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">Este cupom não está disponível no momento.</p>
          )}
          <p className="flex items-start gap-1.5 text-xs text-fg-muted">
            <ShieldCheck className="mt-px size-4 shrink-0 text-brand-700" aria-hidden />O desconto é calculado no carrinho e confirmado no checkout{campaign.restricted ? ", só nos produtos participantes" : ""}.
          </p>
        </div>
      </section>

      {live ? (
        products.length ? (
          <section aria-labelledby="participants-title">
            <SectionHeader id="participants-title" title="Produtos participantes" subtitle={`${total} ${total === 1 ? "produto" : "produtos"} com o cupom ${campaign.code}${total > products.length ? ` — veja uma seleção` : ""}`} />
            <ProductGrid products={products} favorites={favorites} priorityCount={4} />
          </section>
        ) : (
          <EmptyState icon={<SearchX />} title="Nenhum produto participante disponível agora" description="Os produtos desta campanha estão esgotados ou foram pausados. Confira as outras ofertas." action={<ButtonLink href="/ofertas">Explorar ofertas</ButtonLink>} />
        )
      ) : status === "scheduled" ? (
        <EmptyState icon={<Gift />} title="Esta campanha ainda vai começar" description="Os produtos participantes aparecem aqui quando o cupom entrar em vigor." action={<ButtonLink href="/ofertas">Explorar ofertas</ButtonLink>} />
      ) : (
        <EmptyState icon={<Gift />} title="Esta campanha foi encerrada" description="Mas tem muita oferta boa esperando por você." action={<ButtonLink href="/ofertas">Explorar ofertas</ButtonLink>} />
      )}

      <section id="condicoes" aria-labelledby="conditions-title" className="scroll-mt-32 rounded-panel border border-line bg-surface p-4 sm:p-5">
        <h2 id="conditions-title" className="text-lg font-bold">Condições do cupom {campaign.code}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {campaign.conditions.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm text-fg-muted">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
