import { requireSellerPage } from "@/server/auth/guards";
import { ProductListView } from "@/features/products/components/product-list-view";

export const metadata = { title: "Produtos" };

export default async function SellerProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSellerPage("/vendedor/produtos");
  return <ProductListView scope={{ kind: "store", storeId: user.storeId }} mode="seller" basePath="/vendedor/produtos" searchParams={await searchParams} title="Produtos" />;
}
