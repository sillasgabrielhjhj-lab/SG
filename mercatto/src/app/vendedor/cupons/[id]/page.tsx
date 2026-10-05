import { requireSellerPage } from "@/server/auth/guards";
import { getCouponForEdit } from "@/features/marketing/queries";
import { CouponForm } from "@/features/marketing/components/coupon-form";
import { couponState } from "@/features/marketing/components/marketing-ui";
import { getCategoryOptions, orNotFound, toCouponInitial } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Editar cupom" };

export default async function SellerEditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSellerPage(`/vendedor/cupons/${id}`);
  const [categories, coupon] = await Promise.all([getCategoryOptions(), orNotFound(getCouponForEdit({ kind: "store", storeId: user.storeId }, id))]);
  return <CouponForm key={coupon.id} mode="seller" basePath="/vendedor/cupons" couponId={coupon.id} initial={await toCouponInitial(coupon)} categories={categories} state={couponState(coupon)} usedCount={coupon.usedCount} />;
}
