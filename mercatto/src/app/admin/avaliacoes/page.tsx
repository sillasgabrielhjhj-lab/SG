import type { Metadata } from "next";
import Link from "next/link";
import { Star, Trash2 } from "lucide-react";

import { getAdminReviews } from "@/lib/data/admin";
import { deleteReviewAction } from "@/lib/actions/admin";
import { ToggleButton } from "@/components/admin/toggle-button";

export const metadata: Metadata = { title: "Avaliações" };

export default async function AdminReviewsPage() {
  const reviews = await getAdminReviews();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Avaliações</h1>
        <p className="text-sm text-muted-foreground">{reviews.length} avaliações na plataforma</p>
      </div>

      <div className="flex flex-col gap-3">
        {reviews.map((review) => (
          <div key={review.id} className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/produto/${review.product.slug}`} className="text-sm font-medium text-foreground hover:text-primary">
                  {review.product.name}
                </Link>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-3 ${i < review.rating ? "fill-warning text-warning" : "text-muted"}`} />
                  ))}
                </div>
              </div>
              {review.comment && <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {review.user.name} · {review.createdAt.toLocaleDateString("pt-BR")}
              </p>
            </div>
            <ToggleButton action={deleteReviewAction} id={review.id} variant="ghost">
              <Trash2 className="size-3.5" /> Remover
            </ToggleButton>
          </div>
        ))}
      </div>
    </div>
  );
}
