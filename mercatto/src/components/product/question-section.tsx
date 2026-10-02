"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MessageCircleQuestion, Loader2 } from "lucide-react";

import { askQuestionAction } from "@/lib/actions/catalog";
import type { ActionState } from "@/lib/actions/auth";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Question = {
  id: string;
  question: string;
  answer: string | null;
  createdAt: Date;
  user: { name: string };
};

const initialState: ActionState = { status: "idle" };

export function QuestionSection({
  productId,
  productSlug,
  questions,
  isAuthenticated,
}: {
  productId: string;
  productSlug: string;
  questions: Question[];
  isAuthenticated: boolean;
}) {
  const [state, formAction, isPending] = useActionState(askQuestionAction, initialState);

  return (
    <div id="perguntas" className="scroll-mt-20">
      <h2 className="font-display text-xl font-semibold text-foreground">Perguntas e respostas</h2>

      {isAuthenticated ? (
        <form action={formAction} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="productSlug" value={productSlug} />
          <Textarea
            name="question"
            placeholder="Tire sua dúvida sobre este produto..."
            required
            minLength={5}
            className="min-h-10 flex-1"
          />
          <Button type="submit" disabled={isPending} className="shrink-0">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Perguntar
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href="/entrar" className="text-primary hover:underline">Entre</Link> para fazer uma pergunta sobre este produto.
        </p>
      )}

      {state.status === "error" && state.message && (
        <p className="mt-2 text-sm text-destructive">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="mt-2 text-sm text-success">{state.message}</p>
      )}

      {questions.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nenhuma pergunta ainda. Seja o primeiro a perguntar!
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-5">
          {questions.map((q) => (
            <li key={q.id} className="border-b border-border pb-5 last:border-0">
              <div className="flex gap-2">
                <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{q.question}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.user.name} · {q.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              {q.answer && (
                <div className="mt-2 ml-6 rounded-md bg-muted px-3 py-2">
                  <p className="text-sm text-foreground">{q.answer}</p>
                  <p className="text-xs text-muted-foreground">Resposta do vendedor</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
