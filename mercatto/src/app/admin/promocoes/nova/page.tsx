import { requirePermissionPage } from "@/server/auth/guards";
import { getPromotionForEdit } from "@/features/marketing/queries";
import { PromotionForm } from "@/features/marketing/components/promotion-form";
import { defaultPeriod, emptyPromotionInitial, getCampaignOptions, getCategoryOptions, orNull, toPromotionInitial } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Nova promoção" };

export default async function AdminNewPromotionPage({ searchParams }: { searchParams: Promise<{ copiar?: string; campanha?: string }> }) {
  await requirePermissionPage("admin:marketing", "/admin/promocoes/nova");
  const { copiar, campanha } = await searchParams;
  const source = copiar ? await orNull(getPromotionForEdit({ kind: "platform" }, copiar)) : null;
  const period = defaultPeriod();
  const initial = source ? { ...toPromotionInitial(source, period), name: `${source.name} (cópia)`.slice(0, 120) } : { ...emptyPromotionInitial(period), campaignId: campanha ?? null };
  const [categories, campaigns] = await Promise.all([getCategoryOptions(), getCampaignOptions(initial.campaignId)]);
  if (initial.campaignId && !campaigns.some((c) => c.id === initial.campaignId)) initial.campaignId = null;
  return <PromotionForm key={source?.id ?? "new"} mode="admin" basePath="/admin/promocoes" initial={initial} categories={categories} campaigns={campaigns} />;
}
