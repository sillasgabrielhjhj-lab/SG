import Link from "next/link";

import { categories } from "@/lib/mock-data";
import { iconMap } from "@/components/home/icon-map";

export function PopularCategories() {
  const popular = categories.slice(0, 10);

  return (
    <section className="container-page mt-10">
      <h2 className="font-display text-xl font-semibold text-foreground">
        Categorias populares
      </h2>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-10">
        {popular.map((category) => {
          const Icon = iconMap[category.icon];
          return (
            <Link
              key={category.id}
              href={`/categoria/${category.slug}`}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-colors hover:border-primary"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
                {Icon && <Icon className="size-5" />}
              </span>
              <span className="line-clamp-2 text-xs font-medium text-foreground">
                {category.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
