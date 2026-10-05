import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listPendingReviewItems, listUserReviews } from "@/features/reviews/queries";
import { PendingReviews } from "@/features/reviews/components/review-form";
import { ProductImage } from "@/components/commerce/product-image";
import { RatingStars } from "@/components/commerce/rating";
import { DemoBadge } from "@/components/commerce/badges";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Avaliações" };

const STATUS = { PUBLISHED: { label: "Publicada", tone: "success" }, PENDING: { label: "Em análise", tone: "warning" }, REJECTED: { label: "Não publicada", tone: "danger" } } as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ item?: string; pagina?: string }> }) {
  const user = await requireUserPage("/minha-conta/avaliacoes");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const [pending, mine] = await Promise.all([listPendingReviewItems(user.id), listUserReviews(user.id, page)]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <PageHeading title="Avaliações" description="Sua opinião ajuda outros compradores. Só é possível avaliar produtos comprados e entregues." />
        <PendingReviews
          initialItemId={sp.item}
          items={pending.map((i) => ({ id: i.id, productName: i.productName, variantName: i.variantName, imageUrl: i.imageUrl, productSlug: i.product.slug, orderNumber: i.order.number, deliveredAt: i.order.deliveredAt?.toISOString() ?? null }))}
        />
      </section>

      <section aria-labelledby="my-reviews">
        <h2 id="my-reviews" className="mb-3 text-lg font-bold">
          Minhas avaliações
        </h2>
        {mine.items.length === 0 ? (
          <div className="rounded-card border border-line bg-surface">
            <EmptyState compact icon={<MessageSquareText />} title="Você ainda não avaliou produtos" />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {mine.items.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-card border border-line bg-surface p-4">
                <Link href={`/produto/${r.product.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-md border border-line bg-white focus-ring">
                  <ProductImage src={r.product.images[0]?.url ?? null} alt="" sizes="64px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/produto/${r.product.slug}`} className="line-clamp-1 text-sm font-semibold hover:underline">
                      {r.product.name}
                    </Link>
                    <Badge tone={STATUS[r.status].tone} size="xs">
                      {STATUS[r.status].label}
                    </Badge>
                    {r.isDemo ? <DemoBadge /> : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <RatingStars value={r.rating} size="xs" />
                    <span className="text-xs text-fg-subtle">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.title ? <p className="mt-1 text-sm font-semibold">{r.title}</p> : null}
                  {r.comment ? <p className="mt-0.5 text-sm whitespace-pre-line text-fg-muted">{r.comment}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination className="mt-6" page={page} totalPages={mine.totalPages} buildHref={(p) => `/minha-conta/avaliacoes${p > 1 ? `?pagina=${p}` : ""}`} />
      </section>
    </div>
  );
}
