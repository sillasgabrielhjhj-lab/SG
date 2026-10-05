"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/features/catalog/types";
import { ProductCard } from "@/components/commerce/product-card";

/** Carrossel horizontal: scroll-snap no mobile, setas no desktop; nunca vaza a largura da página. */
export function ProductRail({ products, label, favorites, className }: { products: ProductCardData[]; label: string; favorites?: string[]; className?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const fav = new Set(favorites);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  const arrow = "absolute top-[34%] z-10 hidden size-10 place-items-center rounded-full border border-line bg-surface text-fg shadow-raised transition-opacity hover:text-brand-700 focus-ring md:grid";

  return (
    <div className={cn("relative", className)}>
      <ul ref={ref} aria-label={label} className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:scroll-px-0 sm:gap-3 sm:px-0">
        {products.map((p) => (
          <li key={p.id} className="flex w-[44%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[18.8%] xl:w-[15.8%]">
            <ProductCard product={p} variant="compact" favorited={fav.has(p.id)} className="w-full" />
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => scroll(-1)} className={cn(arrow, "-left-4", edges.start && "pointer-events-none opacity-0")} aria-label="Ver anteriores" tabIndex={edges.start ? -1 : 0}>
        <ChevronLeft className="size-5" />
      </button>
      <button type="button" onClick={() => scroll(1)} className={cn(arrow, "-right-4", edges.end && "pointer-events-none opacity-0")} aria-label="Ver próximos" tabIndex={edges.end ? -1 : 0}>
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
