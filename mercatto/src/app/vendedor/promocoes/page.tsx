import { requireSellerPage } from "@/server/auth/guards";
import { PromotionListView } from "@/features/marketing/components/promotion-list-view";

export const metadata = { title: "Promoções" };

export default async function SellerPromotionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSellerPage("/vendedor/promocoes");
  return <PromotionListView mode="seller" scope={{ kind: "store", storeId: user.storeId }} basePath="/vendedor/promocoes" searchParams={await searchParams} />;
}
