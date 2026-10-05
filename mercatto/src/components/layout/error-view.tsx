"use client";

import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tela de erro amigável: nunca exibe mensagem/stack, apenas o código de referência. */
export function ErrorView({ digest, reset }: { digest?: string; reset: () => void }) {
  return (
    <div className="container-page flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-danger-50 text-danger-600">
        <TriangleAlert className="size-8" aria-hidden />
      </span>
      <h1 className="text-2xl font-extrabold">Algo deu errado</h1>
      <p className="text-fg-muted">Tivemos um problema ao carregar esta página. Tente novamente em instantes — seus dados e pedidos estão seguros.</p>
      {digest ? (
        <p className="text-xs text-fg-subtle">
          Código de referência: <code className="font-mono">{digest}</code>
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset} leftIcon={<RefreshCw className="size-4" />}>
          Tentar novamente
        </Button>
        <Link href="/" className="inline-flex h-11 items-center rounded-field px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-ring">
          Voltar à página inicial
        </Link>
      </div>
    </div>
  );
}
