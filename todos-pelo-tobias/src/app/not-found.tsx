import { Heart } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { btn } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="conteudo"
        className="mx-auto grid min-h-[60svh] max-w-xl place-items-center px-4 py-16 text-center"
      >
        <div>
          <Heart aria-hidden className="mx-auto size-12 fill-heart text-heart" />
          <h1 className="mt-6 text-4xl font-black text-brand-950">Página não encontrada</h1>
          <p className="mt-3 text-lg text-muted">
            O endereço que você tentou abrir não existe, mas a campanha continua de portas abertas.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className={btn({ variant: "secondary" })}>
              Voltar ao início
            </Link>
            <Link href="/doar" className={btn()}>
              Quero ajudar
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
