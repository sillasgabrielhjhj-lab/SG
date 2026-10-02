import type { Metadata } from "next";
import { Trash2 } from "lucide-react";

import { getAdminCategories } from "@/lib/data/admin";
import { deleteCategoryAction } from "@/lib/actions/admin";
import { CategoryFormDialog } from "@/components/admin/category-form-dialog";
import { ToggleButton } from "@/components/admin/toggle-button";

export const metadata: Metadata = { title: "Categorias" };

export default async function AdminCategoriesPage() {
  const categories = await getAdminCategories();
  const topCategories = categories.filter((c) => !c.parentId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-sm text-muted-foreground">{categories.length} categorias e subcategorias</p>
        </div>
        <CategoryFormDialog topCategories={topCategories} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border px-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Nome</th>
              <th className="py-3 pr-4 font-medium">Produtos</th>
              <th className="py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 text-sm text-foreground">
                  {category.parent ? (
                    <span className="text-muted-foreground">{category.parent.name} / </span>
                  ) : null}
                  {category.name}
                </td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">{category._count.products}</td>
                <td className="py-3">
                  {category._count.products === 0 && (
                    <ToggleButton action={deleteCategoryAction} id={category.id} variant="ghost">
                      <Trash2 className="size-3.5" /> Remover
                    </ToggleButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
