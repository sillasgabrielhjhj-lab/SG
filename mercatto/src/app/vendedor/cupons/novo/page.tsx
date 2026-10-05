import { requireSellerPage } from "@/server/auth/guards";
import { CouponForm } from "@/features/marketing/components/coupon-form";
import { emptyCouponInitial, getCategoryOptions } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Novo cupom" };

export default async function SellerNewCouponPage() {
  await requireSellerPage("/vendedor/cupons/novo");
  const categories = await getCategoryOptions();
  return <CouponForm mode="seller" basePath="/vendedor/cupons" initial={emptyCouponInitial()} categories={categories} />;
}
