"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { CornerDownRight, MessageCircle, Store } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { DemoBadge } from "@/components/commerce/badges";
import { askQuestionAction } from "@/features/questions/actions";
import { loadQuestionsAction } from "@/features/product/actions";

type QPage = Extract<Awaited<ReturnType<typeof loadQuestionsAction>>, { ok: true }>["data"];

export function ProductQuestions({ productId, initial, isLoggedIn, isOwner }: { productId: string; initial: QPage; isLoggedIn: boolean; isOwner: boolean }) {
  const [data, setData] = useState(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-5">
      {isOwner ? null : isLoggedIn ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await askQuestionAction({ productId, body });
              if (!res.ok) {
                setError(res.fieldErrors?.body?.[0] ?? res.error);
                return;
              }
              setBody("");
              setError(null);
              toast.success(res.message ?? "Pergunta enviada!");
              const refreshed = await loadQuestionsAction({ productId, page: 1 });
              if (refreshed.ok) setData(refreshed.data);
            });
          }}
          className="flex flex-col gap-2"
        >
          <Field label="Pergunte ao vendedor" error={error} hint="Não inclua contatos (telefone, e-mail ou links): toda a negociação acontece na Mercatto.">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} showCount placeholder="Escreva sua pergunta…" className="min-h-20" />
          </Field>
          <Button type="submit" loading={pending} className="self-start" disabled={body.trim().length < 10}>
            Perguntar
          </Button>
        </form>
      ) : (
        <p className="rounded-card bg-surface-muted p-3 text-sm text-fg-muted">
          <Link href={`/entrar?redirect=${encodeURIComponent(`${pathname}#perguntas`)}`} className="font-semibold text-brand-700 hover:underline">
            Entre na sua conta
          </Link>{" "}
          para fazer uma pergunta ao vendedor.
        </p>
      )}

      {data.items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <MessageCircle className="size-4" aria-hidden /> Ninguém perguntou ainda. Seja o primeiro!
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {data.items.map((q) => (
            <li key={q.id} className="flex flex-col gap-1.5">
              <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
                {q.body} {q.isDemo ? <DemoBadge /> : null}
                {q.isFaq ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                    <Store className="size-3" aria-hidden /> Pergunta frequente · respondida pela loja
                  </span>
                ) : (
                  <time dateTime={q.createdAt} className="text-xs text-fg-subtle">
                    {formatDate(q.createdAt)}
                  </time>
                )}
              </p>
              {q.answer ? (
                <p className="flex gap-2 pl-1 text-sm text-fg-muted">
                  <CornerDownRight className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
                  <span>
                    {q.answer.body}{" "}
                    <time dateTime={q.answer.createdAt} className="text-xs text-fg-subtle">
                      {formatDate(q.answer.createdAt)}
                    </time>
                  </span>
                </p>
              ) : (
                <p className="pl-6 text-xs text-fg-subtle">Aguardando resposta do vendedor</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.page < data.totalPages ? (
        <Button
          variant="outline"
          className="self-start"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await loadQuestionsAction({ productId, page: data.page + 1 });
              if (res.ok) setData((prev) => ({ ...res.data, items: [...prev.items, ...res.data.items] }));
            })
          }
        >
          Ver mais perguntas
        </Button>
      ) : null}
    </div>
  );
}
