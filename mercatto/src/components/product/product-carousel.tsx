"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import type { ProductCardData } from "@/lib/data/catalog";

export function ProductCarousel({ products }: { products: ProductCardData[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    slidesToScroll: "auto",
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("init", onSelect);
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  return (
    <div className="relative">
      <div className="overflow-hidden no-scrollbar" ref={emblaRef}>
        <div className="flex gap-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="min-w-[180px] flex-[0_0_42%] sm:flex-[0_0_28%] md:flex-[0_0_22%] lg:flex-[0_0_18%]"
            >
              <ProductCard product={product} className="h-full" />
            </div>
          ))}
        </div>
      </div>

      {canPrev && (
        <Button
          variant="outline"
          size="icon"
          aria-label="Anterior"
          onClick={() => emblaApi?.scrollPrev()}
          className="absolute -left-3 top-1/3 hidden size-9 rounded-full bg-background shadow-md sm:flex"
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}
      {canNext && (
        <Button
          variant="outline"
          size="icon"
          aria-label="Próximo"
          onClick={() => emblaApi?.scrollNext()}
          className="absolute -right-3 top-1/3 hidden size-9 rounded-full bg-background shadow-md sm:flex"
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
