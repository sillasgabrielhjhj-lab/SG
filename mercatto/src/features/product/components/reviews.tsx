"use client";

import { ReviewCard } from "@/features/reviews/components/review-card";
import { useState, useTransition } from "react";
import { Camera, MessageSquare, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { RatingStars } from "@/components/commerce/rating";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadReviewsAction } from "@/features/product/actions";

type ReviewPage = Extract<Awaited<ReturnType<typeof loadReviewsAction>>, { ok: true }>["data"];

export function ProductReviews({ productId, ratingAvg, distribution, total, withPhotos, initial }: { productId: string; ratingAvg: number; distribution: { rating: number; count: number }[]; total: number; withPhotos: number; initial: ReviewPage }) {
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<{ rating?: number; withPhotos?: boolean }>({});
  const [pending, start] = useTransition();

  const load = (next: { rating?: number; withPhotos?: boolean }, page = 1) =>
    start(async () => {
      const res = await loadReviewsAction({ productId, page, ...next });
      if (res.ok) setData((prev) => (page > 1 ? { ...res.data, items: [...prev.items, ...res.data.items] } : res.data));
    });

  if (total === 0) {
    return <EmptyState compact icon={<MessageSquare />} title="Este produto ainda não tem avaliações" description="Somente quem comprou e recebeu o produto pode avaliar — com o selo de compra verificada." />;
  }
  return (
    <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-3">
          <span className="text-5xl font-extrabold tracking-tight text-fg tabular">{ratingAvg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
          <div className="pb-1.5">
            <RatingStars value={ratingAvg} size="md" />
            <p className="text-xs text-fg-muted">{total} avaliações</p>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5">
          {distribution.map((d) => {
            const pct = total ? Math.round((d.count / total) * 100) : 0;
            const active = filter.rating === d.rating;
            return (
              <li key={d.rating}>
                <button
                  type="button"
                  disabled={!d.count}
                  onClick={() => {
                    const next = { ...filter, rating: active ? undefined : d.rating };
                    setFilter(next);
                    load(next);
                  }}
                  aria-pressed={active}
                  className={cn("flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-xs focus-ring disabled:opacity-50", active ? "bg-brand-50 font-semibold" : "hover:bg-surface-muted")}
                >
                  <span className="flex w-6 items-center gap-0.5 tabular">
                    {d.rating}
                    <Star className="size-3 text-sun-500" fill="currentColor" aria-hidden />
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                    <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 text-right text-fg-muted tabular">{d.count}</span>
                  <span className="sr-only">avaliações com {d.rating} estrelas</span>
                </button>
              </li>
            );
          })}
        </ul>
        {withPhotos > 0 ? (
          <Button
            variant={filter.withPhotos ? "secondary" : "outline"}
            size="sm"
            leftIcon={<Camera className="size-4" />}
            onClick={() => {
              const next = { ...filter, withPhotos: !filter.withPhotos };
              setFilter(next);
              load(next);
            }}
          >
            Com fotos ({withPhotos})
          </Button>
        ) : null}
      </div>
      <div className={cn("flex flex-col divide-y divide-line transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {data.items.length === 0 ? <p className="py-6 text-sm text-fg-muted">Nenhuma avaliação com este filtro.</p> : null}
        {data.items.map((r) => (
          <div key={r.id} className="py-5 first:pt-0">
            <ReviewCard author={r.author} rating={r.rating} title={r.title} comment={r.comment} photos={r.photos} videos={r.videos} isVerifiedPurchase={r.isVerifiedPurchase} isDemo={r.isDemo} variantName={r.variantName} />
          </div>
        ))}
        {data.page < data.totalPages ? (
          <div className="pt-4">
            <Button variant="outline" loading={pending} onClick={() => load(filter, data.page + 1)}>
              Ver mais avaliações
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
