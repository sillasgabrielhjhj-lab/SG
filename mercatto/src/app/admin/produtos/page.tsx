import { requirePermissionPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ProductListView } from "@/features/products/components/product-list-view";

export const metadata = { title: "Produtos" };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("admin:catalog", "/admin/produtos");
  const stores = await db.store.findMany({ orderBy: [{ isOfficial: "desc" }, { name: "asc" }], select: { id: true, name: true } });
  return <ProductListView scope={{ kind: "admin-all" }} mode="admin" basePath="/admin/produtos" searchParams={await searchParams} title="Produtos" stores={stores} />;
}
