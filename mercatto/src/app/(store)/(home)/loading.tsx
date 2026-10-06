import { Skeleton } from "@/components/ui/skeleton";
import { ProductCardSkeleton } from "@/components/commerce/product-card";

/** Esqueleto da home: mesma geometria das seções reais (sem salto de layout). */
export default function HomeLoading() {
  return (
    <div className="container-page flex flex-col gap-8 pt-4 sm:gap-10 sm:pt-6" aria-busy="true" aria-label="Carregando a página inicial">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="skeleton h-[15.5rem] rounded-banner sm:h-[18.75rem] lg:h-[22.5rem]" />
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5 lg:gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex w-[68%] shrink-0 items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3 min-[420px]:w-[46%] sm:w-auto">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-3 h-6 w-32" />
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 sm:gap-3 lg:mx-0 lg:px-0">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex w-[5.75rem] shrink-0 flex-col items-center gap-2 rounded-card border border-line bg-surface px-2 py-3 sm:w-28 lg:w-auto lg:min-w-0 lg:flex-1">
              <Skeleton className="size-12 rounded-full sm:size-14" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-3 h-6 w-44" />
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:gap-3 sm:px-0">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="w-[44%] shrink-0 sm:w-[31%] md:w-[23.5%] lg:w-[18.8%] xl:w-[15.8%]">
              <ProductCardSkeleton variant="compact" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
