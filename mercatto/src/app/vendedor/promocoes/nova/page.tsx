import { requireSellerPage } from "@/server/auth/guards";
import { getPromotionForEdit } from "@/features/marketing/queries";
import { PromotionForm } from "@/features/marketing/components/promotion-form";
import { defaultPeriod, emptyPromotionInitial, getCategoryOptions, orNull, toPromotionInitial } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Nova promoção" };

export default async function SellerNewPromotionPage({ searchParams }: { searchParams: Promise<{ copiar?: string }> }) {
  const user = await requireSellerPage("/vendedor/promocoes/nova");
  const { copiar } = await searchParams;
  const [categories, source] = await Promise.all([getCategoryOptions(), copiar ? orNull(getPromotionForEdit({ kind: "store", storeId: user.storeId }, copiar)) : null]);
  const period = defaultPeriod();
  const initial = source ? { ...toPromotionInitial(source, period), name: `${source.name} (cópia)`.slice(0, 120) } : emptyPromotionInitial(period);
  return <PromotionForm key={source?.id ?? "new"} mode="seller" basePath="/vendedor/promocoes" initial={initial} categories={categories} />;
}
