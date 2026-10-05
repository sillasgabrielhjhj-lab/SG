import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MessageSquareText, Star } from "lucide-react";
import type { listStoreReviews } from "@/features/reviews/queries";
import { RatingStars } from "@/components/commerce/rating";
import { DemoBadge } from "@/components/commerce/badges";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/format";

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
            <article className="flex flex-col gap-1.5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars value={r.rating} size="sm" />
                {r.title ? <h3 className="min-w-0 text-sm font-semibold break-words">{r.title}</h3> : null}
                {r.isDemo ? <DemoBadge /> : null}
              </div>
              <Link href={`/produto/${r.product.slug}#avaliacoes`} className="line-clamp-1 self-start text-xs font-semibold text-fg-muted hover:text-brand-700 hover:underline focus-ring">
                {r.product.name}
              </Link>
              {r.comment ? <p className="text-sm break-words whitespace-pre-line text-fg">{r.comment}</p> : <p className="text-sm text-fg-subtle italic">Sem comentário.</p>}
              {r.photos.length ? (
                <ul className="flex flex-wrap gap-2" aria-label="Fotos enviadas pelo comprador">
                  {r.photos.map((src, i) => (
                    <li key={src}>
                      <a href={src} target="_blank" rel="noopener noreferrer" className="relative block size-16 overflow-hidden rounded-md border border-line bg-white focus-ring" aria-label={`Abrir foto ${i + 1} em tamanho real`}>
                        <Image src={src} alt={`Foto ${i + 1} enviada pelo comprador`} fill sizes="64px" unoptimized={src.endsWith(".svg")} className="object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
                <span>{firstName(r.user.name)}</span>
                <span aria-hidden>·</span>
                <time dateTime={r.createdAt.toISOString()}>{formatDate(r.createdAt)}</time>
                {r.isVerifiedPurchase ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-success-700">
                    <BadgeCheck className="size-3.5" aria-hidden /> Compra verificada
                  </span>
                ) : null}
              </p>
            </article>
          </li>
        ))}
      </ul>
      <Pagination page={data.page} totalPages={data.totalPages} buildHref={(p) => buildHref(basePath, rating, p)} />
    </div>
  );
}
