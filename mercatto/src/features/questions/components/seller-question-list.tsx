import Link from "next/link";
import { CheckCircle2, Clock, EyeOff } from "lucide-react";
import type { listStoreQuestions } from "@/features/questions/queries";
import { AnswerQuestionForm } from "@/features/questions/components/answer-question-form";
import { DemoBadge } from "@/components/commerce/badges";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatRelative } from "@/lib/format";

type StoreQuestion = Awaited<ReturnType<typeof listStoreQuestions>>["items"][number];

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Cliente";

/** Perguntas dos anúncios da loja com resposta inline (painel do vendedor). */
export function SellerQuestionList({ items }: { items: StoreQuestion[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((q) => {
        const asker = firstName(q.user.name);
        const productHref = `/produto/${q.product.slug}#perguntas`;
        return (
          <li key={q.id}>
            <article aria-labelledby={`q-${q.id}`} className="rounded-card border border-line bg-surface p-4">
              <div className="flex gap-3">
                <Link href={productHref} tabIndex={-1} aria-hidden className="relative size-14 shrink-0 overflow-hidden rounded-md border border-line bg-white">
                  <ProductImage src={q.product.images[0]?.url ?? null} alt="" sizes="56px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={productHref} className="line-clamp-1 text-xs font-semibold text-fg-muted hover:text-brand-700 hover:underline focus-ring">
                    {q.product.name}
                  </Link>
                  <p id={`q-${q.id}`} className="mt-1 text-sm font-medium break-words whitespace-pre-line text-fg">
                    {q.body}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
                    <span>{q.isFaq ? <span className="font-semibold text-brand-800">Pergunta frequente da loja</span> : <>Por <span className="font-semibold text-fg-muted">{asker}</span></>}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={q.createdAt.toISOString()} title={formatDateTime(q.createdAt)}>
                      {formatRelative(q.createdAt)}
                    </time>
                    {q.answer ? (
                      <Badge tone="success" size="xs" icon={<CheckCircle2 className="size-3" aria-hidden />}>
                        Respondida
                      </Badge>
                    ) : (
                      <Badge tone="warning" size="xs" icon={<Clock className="size-3" aria-hidden />}>
                        Aguardando resposta
                      </Badge>
                    )}
                    {q.status === "PENDING" ? (
                      <Badge tone="neutral" size="xs" icon={<EyeOff className="size-3" aria-hidden />}>
                        Em revisão pela Mercatto
                      </Badge>
                    ) : null}
                    {q.isDemo ? <DemoBadge /> : null}
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:pl-[68px]">
                {q.answer ? (
                  <div className="rounded-md border-l-2 border-brand-300 bg-surface-muted/60 px-3 py-2">
                    <p className="text-xs font-semibold text-fg">
                      Sua resposta ·{" "}
                      <time dateTime={q.answer.createdAt.toISOString()} title={formatDateTime(q.answer.createdAt)} className="font-normal text-fg-subtle">
                        {formatRelative(q.answer.createdAt)}
                      </time>
                    </p>
                    <p className="mt-0.5 text-sm break-words whitespace-pre-line text-fg-muted">{q.answer.body}</p>
                  </div>
                ) : (
                  <AnswerQuestionForm questionId={q.id} askerName={asker} />
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
