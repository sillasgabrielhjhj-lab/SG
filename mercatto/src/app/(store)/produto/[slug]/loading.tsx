import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto da página de produto (galeria + bloco de compra). */
export default function ProductLoading() {
  return (
    <div className="container-page py-4 sm:py-6" aria-busy="true" aria-label="Carregando produto">
      <Skeleton className="h-3 w-56" />
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex gap-3">
          <div className="hidden flex-col gap-2 sm:flex">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-16 rounded-md" />
            ))}
          </div>
          <div className="skeleton aspect-square flex-1 rounded-card" />
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="mt-2 h-9 w-40" />
          <Skeleton className="h-4 w-56" />
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-10 rounded-full" />
            ))}
          </div>
          <Skeleton className="mt-3 h-12 w-full rounded-field" />
          <Skeleton className="h-12 w-full rounded-field" />
        </div>
      </div>
    </div>
  );
}
