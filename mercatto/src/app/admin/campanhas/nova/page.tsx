import { requirePermissionPage } from "@/server/auth/guards";
import { CampaignForm } from "@/features/marketing/components/campaign-form";
import { emptyCampaignInitial } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Nova campanha" };

export default async function AdminNewCampaignPage() {
  await requirePermissionPage("admin:marketing", "/admin/campanhas/nova");
  return <CampaignForm basePath="/admin/campanhas" initial={emptyCampaignInitial()} />;
}
