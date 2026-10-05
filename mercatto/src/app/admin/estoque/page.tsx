import { requirePermissionPage } from "@/server/auth/guards";
import { StockView } from "@/features/inventory/components/stock-view";

export const metadata = { title: "Estoque" };

export default async function AdminStockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("admin:inventory", "/admin/estoque");
  return <StockView scope={{ kind: "admin" }} mode="admin" basePath="/admin/estoque" productBasePath="/admin/produtos" searchParams={await searchParams} />;
}
