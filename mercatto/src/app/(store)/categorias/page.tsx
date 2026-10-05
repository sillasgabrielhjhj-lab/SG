import type { Metadata } from "next";
import Link from "next/link";
import { getAllCategoriesForIndex } from "@/features/storefront/pages.server";
import { buildMetadata } from "@/features/seo/metadata";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CategoryIcon } from "@/components/layout/category-icon";

export const metadata: Metadata = buildMetadata({ title: "Todas as categorias", path: "/categorias", description: "Navegue por todas as categorias da Mercatto." });

export default async function CategoriesIndexPage() {
  const tree = await getAllCategoriesForIndex();
  return (
    <div className="container-page py-4 sm:py-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Categorias" }]} />
      <h1 className="mt-2 mb-5 text-xl font-bold tracking-tight sm:text-2xl">Todas as categorias</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((c) => (
          <li key={c.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <Link href={`/categoria/${c.slug}`} className="flex items-center gap-3 text-base font-bold hover:text-brand-700 focus-ring">
              <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-brand-700">
                <CategoryIcon name={c.icon} className="size-5" />
              </span>
              {c.name}
            </Link>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {c.children.map((ch) => (
                <li key={ch.id}>
                  <Link href={`/categoria/${ch.slug}`} className="inline-flex h-8 items-center rounded-full bg-surface-muted px-3 text-xs font-medium text-fg-muted hover:bg-brand-50 hover:text-brand-800 focus-ring">
                    {ch.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
