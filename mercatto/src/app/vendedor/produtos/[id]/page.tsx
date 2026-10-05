import { notFound } from "next/navigation";
import { requireSellerPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getProductEditorOptions, getProductForEdit } from "@/features/products/queries";
import { ProductEditor } from "@/features/products/components/product-editor";

export const metadata = { title: "Editar produto" };

export default async function SellerEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSellerPage(`/vendedor/produtos/${id}`);
  const [options, product] = await Promise.all([
    getProductEditorOptions(),
    getProductForEdit({ kind: "store", storeId: user.storeId }, id).catch((e: unknown) => {
      if (isAppError(e) && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
  ]);
  return <ProductEditor key={id} mode="seller" options={options} productId={product.id} initial={{ ...product.input, slug: product.input.slug }} storeName={product.store.name} backHref="/vendedor/produtos" publicSlug={product.input.slug} />;
}
