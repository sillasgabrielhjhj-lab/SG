import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/guards";
import { getPromotionForEdit } from "@/features/marketing/queries";
import { PromotionForm } from "@/features/marketing/components/promotion-form";
import { getCampaignOptions, getCategoryOptions, orNotFound, resolveMarketingOwner, toPromotionInitial } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Promoção" };

/** Promoções da plataforma são editáveis; as de lojas abrem em modo leitura (admin só pode encerrá-las). */
export default async function AdminEditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermissionPage("admin:marketing", `/admin/promocoes/${id}`);
  const owner = await resolveMarketingOwner("promotion", id);
  if (!owner) notFound();
  const promo = await orNotFound(getPromotionForEdit(owner.scope, id));
  const [categories, campaigns] = await Promise.all([getCategoryOptions(), getCampaignOptions(promo.campaignId)]);
  const fromStore = owner.scope.kind === "store";
  const closed = promo.state === "EXPIRED" || promo.state === "CANCELLED";
  return (
    <PromotionForm
      key={promo.id}
      mode="admin"
      basePath="/admin/promocoes"
      promotionId={promo.id}
      initial={toPromotionInitial(promo)}
      categories={categories}
      campaigns={campaigns}
      state={promo.state}
      soldCount={promo.soldCount}
      storeName={owner.storeName}
      allowDuplicate={!fromStore}
      readOnlyReason={
        fromStore
          ? `Promoção criada pela loja ${owner.storeName ?? ""}. A administração pode apenas encerrá-la (moderação).`
          : closed
            ? "Promoções encerradas ou canceladas não podem ser editadas. Use “Duplicar” para criar uma nova com os mesmos produtos."
            : undefined
      }
    />
  );
}
