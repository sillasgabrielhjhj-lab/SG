"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { answerQuestionAction } from "@/features/questions/actions";

const MIN = 2;
const MAX = 1000;

/** Resposta inline do vendedor a uma pergunta (limites de answerQuestionSchema). */
export function AnswerQuestionForm({ questionId, askerName }: { questionId: string; askerName: string }) {
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const tooShort = body.trim().length < MIN;

  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (tooShort) {
          setErrors({ body: ["Escreva a resposta"] });
          return;
        }
        start(async () => {
          const res = await answerQuestionAction({ questionId, body });
          if (!res.ok) {
            // Bloqueios do filtro de moderação (links, telefone...) chegam sem fieldErrors: mostramos junto ao campo.
            setErrors(res.fieldErrors ?? (res.code === "UNPROCESSABLE" ? { body: [res.error] } : {}));
            toast.error(res.error);
            if (res.code === "CONFLICT") router.refresh();
            return;
          }
          setErrors({});
          setBody("");
          toast.success(res.message ?? "Resposta publicada.");
          router.refresh();
        });
      }}
    >
      <Field
        label={
          <>
            Sua resposta<span className="sr-only"> à pergunta de {askerName}</span>
          </>
        }
        error={errors.body}
        hint="A resposta fica visível no anúncio para todos os clientes."
      >
        <Textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (errors.body) setErrors({});
          }}
          rows={3}
          minLength={MIN}
          maxLength={MAX}
          showCount
          placeholder="Olá! Obrigado pelo interesse…"
          className="min-h-20"
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={pending} loadingText="Enviando…" disabled={tooShort} leftIcon={<Send className="size-4" />}>
          Responder
        </Button>
      </div>
    </form>
  );
}
