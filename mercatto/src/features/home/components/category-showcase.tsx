import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { CategoryIcon } from "@/components/layout/category-icon";
import type { CategoryNode } from "@/features/catalog/types";
import { cn } from "@/lib/utils";

/** Tons alternados (todos da paleta da marca) para dar ritmo visual sem poluir. */
const TINTS = [
  "bg-brand-50 text-brand-700 group-hover:bg-brand-100",
  "bg-sun-50 text-sun-700 group-hover:bg-sun-100",
  "bg-info-50 text-info-700 group-hover:bg-info-50",
  "bg-coral-50 text-coral-600 group-hover:bg-coral-100",
  "bg-success-50 text-success-700 group-hover:bg-success-50",
];

/** No desktop as categorias cabem em uma linha; as demais ficam em "Ver todas". */
const MAX_VISIBLE = 12;

/** Categorias em cards: ícone em círculo, hover com elevação e ícone crescendo; mobile/tablet com scroll horizontal. */
export function CategoryShowcase({ categories }: { categories: CategoryNode[] }) {
  if (!categories.length) return null;
  return (
    <section aria-labelledby="cat-title" className="animate-enter [--enter-delay:200ms]">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="cat-title" className="text-lg font-bold tracking-tight text-fg sm:text-xl">
          Categorias
        </h2>
        <Link href="/categorias" className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline focus-ring">
          Ver todas <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
      <ul data-stagger className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1.5 scrollbar-none sm:gap-3 lg:mx-0 lg:overflow-visible lg:px-0">
        {categories.slice(0, MAX_VISIBLE).map((c, i) => (
          <li key={c.id} style={{ "--i": i } as CSSProperties} className="w-[5.75rem] shrink-0 snap-start sm:w-28 lg:w-auto lg:min-w-0 lg:flex-1">
            <Link
              href={`/categoria/${c.slug}`}
              className="group flex h-full flex-col items-center gap-2 rounded-card border border-line bg-surface px-2 py-3 text-center shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out-soft hover:border-brand-200 focus-ring active:scale-[0.97] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:scale-[1.02] [@media(hover:hover)]:hover:shadow-lift"
            >
              <span className={cn("grid size-12 place-items-center rounded-full transition-[transform,background-color] duration-200 ease-out-soft group-hover:scale-110 sm:size-14", TINTS[i % TINTS.length])}>
                <CategoryIcon name={c.icon} className="size-6 sm:size-7" />
              </span>
              <span className="line-clamp-2 text-xs leading-tight font-semibold text-fg group-hover:text-brand-800">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
