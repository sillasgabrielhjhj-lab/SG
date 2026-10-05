import { requirePermissionPage } from "@/server/auth/guards";
import { listCategoriesAdmin } from "@/features/admin/queries";
import { CategoryManager, type CategoryRow } from "@/features/admin/components/catalog-managers";
import { CATEGORY_ICON_NAMES } from "@/components/layout/category-icon";
import { PageHeading } from "@/components/layout/page-heading";

export const metadata = { title: "Categorias" };

export default async function AdminCategoriesPage() {
  await requirePermissionPage("admin:catalog", "/admin/categorias");
  const all = await listCategoriesAdmin();
  // Ordena em árvore (pai seguido dos filhos) com profundidade.
  const byParent = new Map<string | null, typeof all>();
  for (const c of all) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  const rows: CategoryRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of (byParent.get(parentId) ?? []).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))) {
      rows.push({
        id: c.id, name: c.name, slug: c.slug, description: c.description, icon: c.icon, imageUrl: c.imageUrl, parentId: c.parentId, position: c.position,
        isActive: c.isActive, isFeatured: c.isFeatured, seoTitle: c.seoTitle, seoDescription: c.seoDescription, depth,
        productCount: c._count.products, childCount: c._count.children,
        attributes: c.attributes.map((a) => ({ id: a.id, categoryId: a.categoryId, name: a.name, key: a.key, type: a.type, options: a.options, unit: a.unit, isFilterable: a.isFilterable, isRequired: a.isRequired, position: a.position })),
      });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return (
    <div>
      <PageHeading title="Categorias" description={`${rows.length} categoria(s). Organize a árvore e os atributos usados na ficha técnica e nos filtros.`} />
      <CategoryManager rows={rows} icons={CATEGORY_ICON_NAMES} />
    </div>
  );
}
