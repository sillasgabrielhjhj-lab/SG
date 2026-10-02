import { PackageSearch } from "lucide-react";

import { ProductCard } from "@/components/product/product-card";
import type { ProductCardData } from "@/lib/data/catalog";

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
        <PackageSearch className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nenhum produto encontrado com esses filtros.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
