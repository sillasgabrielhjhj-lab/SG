import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ProductCarousel } from "@/components/product/product-carousel";
import type { ProductCardData } from "@/lib/data/catalog";

export function ProductSection({
  title,
  seeAllHref,
  products,
}: {
  title: string;
  seeAllHref: string;
  products: ProductCardData[];
}) {
  return (
    <section className="container-page mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {title}
        </h2>
        <Link
          href={seeAllHref}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver tudo <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="mt-4">
        <ProductCarousel products={products} />
      </div>
    </section>
  );
}
