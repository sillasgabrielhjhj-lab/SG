import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="bg-brand-800">
        <div className="container-page flex h-14 items-center">
          <Link href="/" className="rounded-md focus-ring" aria-label="Mercatto — página inicial">
            <Logo tone="inverse" size="sm" />
          </Link>
        </div>
      </header>
      <main className="container-page flex max-w-xl flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-700">
          <SearchX className="size-8" aria-hidden />
        </span>
        <p className="text-sm font-bold tracking-wider text-brand-700">ERRO 404</p>
        <h1 className="text-2xl font-extrabold">Não encontramos esta página</h1>
        <p className="text-fg-muted">O endereço pode ter mudado ou o produto não está mais disponível. Que tal buscar o que você procura?</p>
        <form action="/buscar" method="get" role="search" className="flex w-full max-w-md gap-2">
          <label htmlFor="nf-q" className="sr-only">
            Buscar produtos
          </label>
          <input id="nf-q" name="q" placeholder="Buscar produtos, marcas…" className="h-11 flex-1 rounded-field border border-line-strong bg-surface px-4 text-sm focus:border-brand-600 focus:shadow-focus focus:outline-none" />
          <button type="submit" className="h-11 rounded-field bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-ring">
            Buscar
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href="/" variant="outline">
            Página inicial
          </ButtonLink>
          <ButtonLink href="/ofertas" variant="ghost">
            Ver ofertas
          </ButtonLink>
          <ButtonLink href="/categorias" variant="ghost">
            Categorias
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
