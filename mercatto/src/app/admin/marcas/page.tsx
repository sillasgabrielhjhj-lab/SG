import { Search } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { listBrandsAdmin } from "@/features/admin/queries";
import { BrandManager } from "@/features/admin/components/catalog-managers";
import { PageHeading } from "@/components/layout/page-heading";

export const metadata = { title: "Marcas" };

export default async function AdminBrandsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermissionPage("admin:catalog", "/admin/marcas");
  const q = (await searchParams).q?.trim().slice(0, 60) || undefined;
  const brands = await listBrandsAdmin(q);
  return (
    <div>
      <PageHeading title="Marcas" description={`${brands.length} marca(s)`} />
      <form method="get" className="mb-3 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Buscar marca</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Buscar marca" className="h-10 w-full rounded-field border border-line-strong bg-surface pr-3 pl-9 text-sm focus:border-brand-600 focus:shadow-focus focus:outline-none" />
        </label>
        <button type="submit" className="h-10 rounded-field bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 focus-ring">
          Buscar
        </button>
      </form>
      <BrandManager rows={brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl, isFeatured: b.isFeatured, productCount: b._count.products }))} />
    </div>
  );
}
