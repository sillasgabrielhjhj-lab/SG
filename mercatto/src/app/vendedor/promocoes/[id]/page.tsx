import { requireSellerPage } from "@/server/auth/guards";
import { getPromotionForEdit } from "@/features/marketing/queries";
import { PromotionForm } from "@/features/marketing/components/promotion-form";
import { getCategoryOptions, orNotFound, toPromotionInitial } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Editar promoção" };

export default async function SellerEditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSellerPage(`/vendedor/promocoes/${id}`);
  const [categories, promo] = await Promise.all([getCategoryOptions(), orNotFound(getPromotionForEdit({ kind: "store", storeId: user.storeId }, id))]);
  const closed = promo.state === "EXPIRED" || promo.state === "CANCELLED";
  return (
    <PromotionForm
      key={promo.id}
      mode="seller"
      basePath="/vendedor/promocoes"
      promotionId={promo.id}
      initial={toPromotionInitial(promo)}
      categories={categories}
      state={promo.state}
      soldCount={promo.soldCount}
      readOnlyReason={closed ? "Promoções encerradas ou canceladas não podem ser editadas. Use “Duplicar” para criar uma nova com os mesmos produtos." : undefined}
    />
  );
}
