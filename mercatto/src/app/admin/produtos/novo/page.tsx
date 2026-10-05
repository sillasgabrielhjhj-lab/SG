import { requirePermissionPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getProductEditorOptions } from "@/features/products/queries";
import { getOfficialStoreId } from "@/features/products/service";
import { ProductEditor } from "@/features/products/components/product-editor";

export const metadata = { title: "Novo produto" };

export default async function AdminNewProductPage() {
  await requirePermissionPage("admin:catalog", "/admin/produtos/novo");
  const [options, store] = await Promise.all([getProductEditorOptions(), getOfficialStoreId().then((id) => db.store.findUniqueOrThrow({ where: { id }, select: { name: true } }))]);
  return <ProductEditor mode="admin" options={options} storeName={store.name} backHref="/admin/produtos" />;
}
