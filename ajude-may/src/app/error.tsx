"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { btn } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto grid min-h-svh max-w-xl place-items-center px-4 py-16 text-center">
      <div>
        <TriangleAlert aria-hidden className="mx-auto size-12 text-petal-500" />
        <h1 className="mt-6 text-4xl font-semibold text-ink">Algo deu errado</h1>
        <p className="mt-3 text-lg text-muted">
          Não foi possível carregar esta página agora. Tente novamente em instantes.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className={btn()}>
            Tentar novamente
          </button>
          <Link href="/" className={btn({ variant: "secondary" })}>
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
