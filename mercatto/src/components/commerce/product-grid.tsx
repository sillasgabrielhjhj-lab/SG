import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/features/catalog/types";
import { ProductCard, ProductCardSkeleton } from "@/components/commerce/product-card";

export function ProductGrid({ products, favorites, className, columns = "default", priorityCount = 0, listName, ranked }: { products: ProductCardData[]; favorites?: Set<string>; className?: string; columns?: "default" | "wide"; priorityCount?: number; listName?: string; ranked?: boolean }) {
  return (
    <ul data-stagger className={cn("grid grid-cols-2 gap-2 sm:gap-3", columns === "default" ? "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6", className)}>
      {products.map((p, i) => (
        <li key={p.id} style={{ "--i": i } as CSSProperties} className="flex">
          <ProductCard product={p} favorited={favorites?.has(p.id)} priority={i < priorityCount} listName={listName} rank={ranked ? i + 1 : undefined} className="w-full" />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 10, columns = "default" }: { count?: number; columns?: "default" | "wide" }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:gap-3", columns === "default" ? "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6")}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SectionHeader({ title, subtitle, href, linkLabel = "Ver todos", icon, aside, className, id }: { title: ReactNode; subtitle?: ReactNode; href?: string; linkLabel?: string; icon?: ReactNode; aside?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 [&_svg]:size-5">{icon}</span> : null}
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-bold tracking-tight text-fg sm:text-xl">
            {title}
          </h2>
          {subtitle ? <p className="text-sm text-fg-muted">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {aside}
        {href ? (
          <a href={href} className="text-sm font-semibold text-brand-700 hover:underline focus-ring">
            {linkLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
