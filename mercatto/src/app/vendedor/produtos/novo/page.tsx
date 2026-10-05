import { requireSellerPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getProductEditorOptions } from "@/features/products/queries";
import { ProductEditor } from "@/features/products/components/product-editor";

export const metadata = { title: "Novo produto" };

export default async function SellerNewProductPage() {
  const user = await requireSellerPage("/vendedor/produtos/novo");
  const [options, store] = await Promise.all([getProductEditorOptions(), db.store.findUniqueOrThrow({ where: { id: user.storeId }, select: { name: true } })]);
  return <ProductEditor mode="seller" options={options} storeName={store.name} backHref="/vendedor/produtos" />;
}
