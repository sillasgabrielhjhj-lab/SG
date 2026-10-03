import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function HeroBanner() {
  return (
    <section className="container-page pt-6">
      <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-10 sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 size-64 rounded-full bg-primary-foreground/10"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 right-32 size-72 rounded-full bg-accent/20"
        />

        <div className="relative z-10 max-w-xl">
          <span className="inline-block rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium text-primary-foreground">
            Semana da Mercatto
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold text-balance text-primary-foreground sm:text-4xl lg:text-5xl">
            Até 40% de desconto em milhares de produtos
          </h1>
          <p className="mt-3 text-primary-foreground/85">
            Vendedores verificados, entrega rastreada e compra 100%
            protegida do início ao fim.
          </p>
          <Button asChild size="lg" variant="accent" className="mt-6">
            <Link href="/categoria/eletronicos">
              Ver ofertas <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
