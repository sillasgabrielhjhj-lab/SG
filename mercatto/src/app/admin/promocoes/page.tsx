import { requirePermissionPage } from "@/server/auth/guards";
import { PromotionListView } from "@/features/marketing/components/promotion-list-view";

export const metadata = { title: "Promoções" };

export default async function AdminPromotionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("admin:marketing", "/admin/promocoes");
  return <PromotionListView mode="admin" scope={{ kind: "all" }} basePath="/admin/promocoes" searchParams={await searchParams} />;
}
