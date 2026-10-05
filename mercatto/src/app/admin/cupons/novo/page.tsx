import { requirePermissionPage } from "@/server/auth/guards";
import { CouponForm } from "@/features/marketing/components/coupon-form";
import { emptyCouponInitial, getCategoryOptions } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Novo cupom" };

export default async function AdminNewCouponPage() {
  await requirePermissionPage("admin:marketing", "/admin/cupons/novo");
  const categories = await getCategoryOptions();
  return <CouponForm mode="admin" basePath="/admin/cupons" initial={emptyCouponInitial()} categories={categories} />;
}
