import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  user: { name: string };
};

export function ReviewSection({
  reviews,
  ratingAvg,
  ratingCount,
}: {
  reviews: Review[];
  ratingAvg: number;
  ratingCount: number;
}) {
  const breakdown = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
    return { star, count, pct };
  });

  return (
    <div id="avaliacoes" className="scroll-mt-20">
      <h2 className="font-display text-xl font-semibold text-foreground">Avaliações</h2>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-1 sm:w-44">
          <p className="font-display text-4xl font-bold text-foreground">
            {ratingAvg.toFixed(1)}
          </p>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`size-4 ${
                  i < Math.round(ratingAvg) ? "fill-warning text-warning" : "text-muted"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{ratingCount} avaliações</p>
        </div>

        <div className="flex-1 space-y-1.5">
          {breakdown.map(({ star, pct }) => (
            <div key={star} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-10 shrink-0">{star} estrelas</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-warning" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right">{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Este produto ainda não tem avaliações.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-5">
          {reviews.map((review) => (
            <li key={review.id} className="border-b border-border pb-5 last:border-0">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-3.5 ${
                        i < review.rating ? "fill-warning text-warning" : "text-muted"
                      }`}
                    />
                  ))}
                </div>
                {review.isVerifiedPurchase && (
                  <Badge variant="outline" className="text-xs">Compra verificada</Badge>
                )}
              </div>
              {review.title && (
                <p className="mt-1.5 text-sm font-medium text-foreground">{review.title}</p>
              )}
              {review.comment && (
                <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {review.user.name} · {review.createdAt.toLocaleDateString("pt-BR")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
