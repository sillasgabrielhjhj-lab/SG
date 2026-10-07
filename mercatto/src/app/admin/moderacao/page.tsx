import Link from "next/link";
import { ReviewVideos } from "@/features/reviews/components/review-videos";
import { MessageSquareWarning } from "lucide-react";
import type { QuestionStatus, ReviewStatus } from "@/generated/prisma/enums";
import { requirePermissionPage } from "@/server/auth/guards";
import { listReviewsForModeration } from "@/features/reviews/queries";
import { listQuestionsForModeration } from "@/features/questions/queries";
import { QuestionModeration, ReviewModeration } from "@/features/admin/components/people-actions";
import { PageHeading } from "@/components/layout/page-heading";
import { FilterTabs, buildHref } from "@/components/layout/filter-tabs";
import { RatingStars } from "@/components/commerce/rating";
import { DemoBadge } from "@/components/commerce/badges";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Moderação" };

const STATUSES = ["PENDING", "PUBLISHED", "REJECTED"] as const;
const LABEL = { PENDING: "Pendentes", PUBLISHED: "Publicadas", REJECTED: "Rejeitadas" } as const;

export default async function AdminModerationPage({ searchParams }: { searchParams: Promise<{ aba?: string; status?: string; pagina?: string }> }) {
  await requirePermissionPage("admin:moderation", "/admin/moderacao");
  const sp = await searchParams;
  const tab = sp.aba === "perguntas" ? "perguntas" : "avaliacoes";
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof STATUSES)[number]) : "PENDING";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const href = (p: Record<string, string | number | undefined>) => buildHref("/admin/moderacao", { aba: tab === "avaliacoes" ? undefined : tab, status: status === "PENDING" ? undefined : status, ...p });

  const tabs = (
    <>
      <FilterTabs label="Tipo de conteúdo" items={[{ label: "Avaliações", href: buildHref("/admin/moderacao", {}), active: tab === "avaliacoes" }, { label: "Perguntas", href: buildHref("/admin/moderacao", { aba: "perguntas" }), active: tab === "perguntas" }]} />
      <FilterTabs label="Status" items={STATUSES.map((s) => ({ label: LABEL[s], href: href({ status: s === "PENDING" ? undefined : s, pagina: undefined }), active: status === s }))} />
    </>
  );

  if (tab === "perguntas") {
    const data = await listQuestionsForModeration({ status: status as QuestionStatus, page });
    return (
      <div>
        <PageHeading title="Moderação" description="Perguntas sinalizadas pelo filtro automático ficam pendentes até a revisão." />
        {tabs}
        {data.items.length === 0 ? (
          <div className="rounded-card border border-line bg-surface">
            <EmptyState icon={<MessageSquareWarning />} title="Nada por aqui" description="Nenhuma pergunta neste status." />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.items.map((q) => (
              <li key={q.id} className="rounded-card border border-line bg-surface p-4">
                <p className="text-xs text-fg-muted">
                  <Link href={`/produto/${q.product.slug}`} target="_blank" className="font-semibold text-brand-700 hover:underline">
                    {q.product.name}
                  </Link>{" "}
                  · {q.product.store.name} · {q.user.name} · {formatDateTime(q.createdAt)} {q.isDemo ? <DemoBadge /> : null}
                </p>
                <p className="mt-1 text-sm whitespace-pre-line">{q.body}</p>
                {q.answer ? <p className="mt-2 border-l-2 border-brand-300 pl-3 text-sm text-fg-muted">Resposta: {q.answer.body}</p> : null}
                <div className="mt-3">
                  <QuestionModeration questionId={q.id} status={q.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => href({ pagina: p })} />
      </div>
    );
  }

  const data = await listReviewsForModeration({ status: status as ReviewStatus, page });
  return (
    <div>
      <PageHeading title="Moderação" description="Avaliações com termos sinalizados ou fotos aguardam revisão antes de publicar." />
      {tabs}
      {data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<MessageSquareWarning />} title="Nada por aqui" description="Nenhuma avaliação neste status." />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars value={r.rating} size="xs" />
                {r.isVerifiedPurchase ? <Badge tone="success" size="xs">Compra verificada</Badge> : null}
                {r.isDemo ? <DemoBadge /> : null}
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                <Link href={`/produto/${r.product.slug}`} target="_blank" className="font-semibold text-brand-700 hover:underline">
                  {r.product.name}
                </Link>{" "}
                · {r.product.store.name} · {r.user.name} · {formatDateTime(r.createdAt)}
              </p>
              {r.title ? <p className="mt-2 text-sm font-semibold">{r.title}</p> : null}
              {r.comment ? <p className="mt-0.5 text-sm whitespace-pre-line text-fg-muted">{r.comment}</p> : null}
              <ReviewVideos urls={r.videos} />
              {r.photos.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.photos.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block size-16 overflow-hidden rounded-md border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto enviada pelo cliente */}
                      <img src={url} alt="Foto da avaliação" className="size-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
              {r.moderationNote ? <p className="mt-2 rounded-md bg-warning-50 px-2 py-1 text-xs text-warning-700">Nota de moderação: {r.moderationNote}</p> : null}
              <div className="mt-3">
                <ReviewModeration reviewId={r.id} status={r.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => href({ pagina: p })} />
    </div>
  );
}
