import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/commerce/product-grid";

export function ListingSkeleton() {
  return (
    <div className="container-page py-4 sm:py-6" aria-busy="true" aria-label="Carregando produtos">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 mb-5 h-7 w-72" />
      <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
        <div className="hidden flex-col gap-3 rounded-card border border-line bg-surface p-4 lg:flex">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
        <ProductGridSkeleton count={10} />
      </div>
    </div>
  );
}
