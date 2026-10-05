import { requirePermissionPage } from "@/server/auth/guards";
import { getCampaign } from "@/features/marketing/queries";
import { CampaignForm } from "@/features/marketing/components/campaign-form";
import { campaignState } from "@/features/marketing/components/marketing-ui";
import { countCampaignPromotions, orNotFound, toCampaignInitial } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Editar campanha" };

export default async function AdminEditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermissionPage("admin:marketing", `/admin/campanhas/${id}`);
  const [campaign, promotionsCount] = await Promise.all([orNotFound(getCampaign(id)), countCampaignPromotions(id)]);
  return <CampaignForm key={campaign.id} basePath="/admin/campanhas" campaignId={campaign.id} initial={toCampaignInitial(campaign)} state={campaignState(campaign)} promotionsCount={promotionsCount} />;
}
