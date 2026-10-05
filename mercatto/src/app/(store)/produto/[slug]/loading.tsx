import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-page py-6" aria-busy="true" aria-label="Carregando produto">
      <Skeleton className="h-3 w-64" />
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="skeleton aspect-square w-full rounded-card" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <div className="mt-2 flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
