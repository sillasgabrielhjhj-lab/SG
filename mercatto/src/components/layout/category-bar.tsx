import Link from "next/link";

import { categories } from "@/lib/mock-data";

export function CategoryBar() {
  return (
    <nav
      aria-label="Categorias"
      className="hidden border-b border-border bg-background md:block"
    >
      <div className="container-page no-scrollbar flex gap-5 overflow-x-auto py-2.5 text-sm">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categoria/${category.slug}`}
            className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
