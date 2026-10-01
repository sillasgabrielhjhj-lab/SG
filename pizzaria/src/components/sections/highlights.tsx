import { ArrowRight } from 'lucide-react';
import { FeaturedCard } from '@/components/menu/featured-card';
import { Accent, SectionHeading } from '@/components/ui/section-heading';
import { Reveal } from '@/components/ui/reveal';
import { featuredProducts } from '@/lib/menu';

export function Highlights() {
  return (
    <section id="destaques" aria-labelledby="destaques-title" className="bg-cream-100 py-20 lg:py-28">
      <div className="container-page">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id="destaques-title"
            eyebrow="Os mais pedidos"
            title={
              <>
                Os favoritos <Accent>da casa.</Accent>
              </>
            }
            description="As pizzas que nossos clientes pedem de novo e de novo. Todas podem ser meio a meio."
          />
          <a
            href="#cardapio"
            className="group inline-flex shrink-0 items-center gap-2 text-[0.9375rem] font-semibold text-ink-900 underline-offset-4 hover:underline"
          >
            Ver cardápio completo
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </a>
        </div>

        <ul className="scrollbar-none -mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
          {featuredProducts.map((product, i) => (
            <Reveal
              as="li"
              key={product.id}
              delay={(i % 3) * 0.08}
              className="w-[82%] shrink-0 snap-start sm:w-auto"
            >
              <FeaturedCard product={product} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
