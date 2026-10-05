import { requirePermissionPage } from "@/server/auth/guards";
import { CouponListView } from "@/features/marketing/components/coupon-list-view";

export const metadata = { title: "Cupons" };

export default async function AdminCouponsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("admin:marketing", "/admin/cupons");
  return <CouponListView mode="admin" scope={{ kind: "all" }} basePath="/admin/cupons" searchParams={await searchParams} />;
}
