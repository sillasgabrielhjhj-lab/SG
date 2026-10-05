import { requireSellerPage } from "@/server/auth/guards";
import { StockView } from "@/features/inventory/components/stock-view";

export const metadata = { title: "Estoque" };

export default async function SellerStockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSellerPage("/vendedor/estoque");
  return <StockView scope={{ kind: "store", storeId: user.storeId }} mode="seller" basePath="/vendedor/estoque" productBasePath="/vendedor/produtos" searchParams={await searchParams} />;
}
