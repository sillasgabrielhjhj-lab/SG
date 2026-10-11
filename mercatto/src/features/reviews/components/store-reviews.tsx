import { ReviewCard } from "@/features/reviews/components/review-card";
import Link from "next/link";
import { MessageSquareText, Star } from "lucide-react";
import type { listStoreReviews } from "@/features/reviews/queries";
import { RatingStars } from "@/components/commerce/rating";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

type StoreReviewsData = Awaited<ReturnType<typeof listStoreReviews>>;

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Cliente";
const stars = (n: number) => `${n} ${n === 1 ? "estrela" : "estrelas"}`;

function buildHref(basePath: string, rating?: number, page?: number) {
  const s = new URLSearchParams();
  if (rating) s.set("nota", String(rating));
  if (page && page > 1) s.set("pagina", String(page));
  const str = s.toString();
  return `${basePath}${str ? `?${str}` : ""}`;
}

/** Resumo da reputação + distribuição de notas da loja. */
export function StoreReviewsSummary({ ratingAvg, ratingCount, distribution }: { ratingAvg: number; ratingCount: number; distribution: StoreReviewsData["distribution"] }) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  return (
    <section aria-labelledby="resumo-avaliacoes" className="grid gap-5 rounded-card border border-line bg-surface p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:p-5">
      <h2 id="resumo-avaliacoes" className="sr-only">
        Resumo das avaliações
      </h2>
      <div className="flex items-end gap-3">
        <span className="text-5xl font-extrabold tracking-tight text-fg tabular">{ratingCount ? ratingAvg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "–"}</span>
        <div className="pb-1.5">
          <RatingStars value={ratingCount ? ratingAvg : 0} size="md" />
          <p className="text-xs text-fg-muted">{ratingCount ? `${formatNumber(ratingCount)} avaliação(ões) da loja` : "Ainda sem avaliações"}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5" aria-label="Distribuição das notas">
        {distribution.map((d) => {
          const pct = total ? Math.round((d.count / total) * 100) : 0;
          return (
            <li key={d.rating} className="flex items-center gap-2 text-xs">
              <span className="flex w-7 items-center gap-0.5 font-medium tabular" aria-hidden>
                {d.rating}
                <Star className="size-3 text-sun-500" fill="currentColor" />
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-16 text-right text-fg-muted tabular" aria-hidden>
                {d.count} ({pct}%)
              </span>
              <span className="sr-only">
                {stars(d.rating)}: {d.count} avaliação(ões), {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Chips de filtro por nota (links na URL, mantidos ao paginar). */
export function StoreReviewsFilter({ basePath, rating, distribution }: { basePath: string; rating?: number; distribution: StoreReviewsData["distribution"] }) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap focus-ring",
      active ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-line bg-surface text-fg-muted hover:border-brand-300",
    );
  return (
    <nav aria-label="Filtrar por nota" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
      <Link href={buildHref(basePath)} aria-current={!rating ? "page" : undefined} className={chip(!rating)}>
        Todas
        <span className="rounded-full bg-surface-muted px-1.5 text-2xs font-bold tabular">{total}</span>
      </Link>
      {distribution.map((d) => {
        const active = rating === d.rating;
        return (
          <Link key={d.rating} href={buildHref(basePath, d.rating)} aria-current={active ? "page" : undefined} aria-label={`${stars(d.rating)} (${d.count})`} className={chip(active)}>
            <span className="flex items-center gap-0.5 tabular" aria-hidden>
              {d.rating}
              <Star className="size-3.5 text-sun-500" fill="currentColor" />
            </span>
            <span className="rounded-full bg-surface-muted px-1.5 text-2xs font-bold tabular" aria-hidden>
              {d.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Lista somente leitura das avaliações dos produtos da loja (painel do vendedor). */
export function StoreReviewsList({ data, basePath, rating }: { data: StoreReviewsData; basePath: string; rating?: number }) {
  if (data.items.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface">
        {data.page > 1 && data.total > 0 ? (
          <EmptyState
            icon={<MessageSquareText />}
            title="Nenhuma avaliação nesta página"
            action={
              <ButtonLink href={buildHref(basePath, rating)} variant="outline" size="sm">
                Voltar para a primeira página
              </ButtonLink>
            }
          />
        ) : rating ? (
          <EmptyState
            icon={<MessageSquareText />}
            title={`Nenhuma avaliação com ${stars(rating)}`}
            action={
              <ButtonLink href={buildHref(basePath)} variant="outline" size="sm">
                Ver todas as avaliações
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState icon={<MessageSquareText />} title="Sua loja ainda não recebeu avaliações" description="Somente quem comprou e recebeu o produto pode avaliar. As avaliações publicadas aparecem aqui." />
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {data.items.map((r) => (
          <li key={r.id}>
            <div className="p-4 sm:p-5">
              <ReviewCard author={firstName(r.user.name)} rating={r.rating} title={r.title} comment={r.comment} photos={r.photos} videos={r.videos} isVerifiedPurchase={r.isVerifiedPurchase} isDemo={r.isDemo} product={r.product} date={r.createdAt} />
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={data.page} totalPages={data.totalPages} buildHref={(p) => buildHref(basePath, rating, p)} />
    </div>
  );
}
