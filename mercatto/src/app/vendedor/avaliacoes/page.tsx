import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";
import { getSellerByUserId, getSellerReviews } from "@/lib/data/seller";
import { BecomeSellerForm } from "@/app/vendedor/become-seller-form";

export const metadata: Metadata = { title: "Avaliações" };

export default async function SellerReviewsPage() {
  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);
  if (!seller) return <BecomeSellerForm />;

  const reviews = await getSellerReviews(seller.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Avaliações</h1>
        <p className="text-sm text-muted-foreground">O que seus clientes estão dizendo.</p>
      </div>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Star className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma avaliação recebida ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <Link href={`/produto/${review.product.slug}`} className="text-sm font-medium text-foreground hover:text-primary">
                  {review.product.name}
                </Link>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-3.5 ${i < review.rating ? "fill-warning text-warning" : "text-muted"}`} />
                  ))}
                </div>
              </div>
              {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {review.user.name} · {review.createdAt.toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
