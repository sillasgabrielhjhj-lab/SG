import { requireSellerPage } from "@/server/auth/guards";
import { CouponListView } from "@/features/marketing/components/coupon-list-view";

export const metadata = { title: "Cupons" };

export default async function SellerCouponsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSellerPage("/vendedor/cupons");
  return <CouponListView mode="seller" scope={{ kind: "store", storeId: user.storeId }} basePath="/vendedor/cupons" searchParams={await searchParams} />;
}
