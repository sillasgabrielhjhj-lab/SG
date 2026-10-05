import { requirePermissionPage } from "@/server/auth/guards";
import { CampaignListView } from "@/features/marketing/components/campaign-list-view";

export const metadata = { title: "Campanhas" };

export default async function AdminCampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("admin:marketing", "/admin/campanhas");
  return <CampaignListView basePath="/admin/campanhas" searchParams={await searchParams} />;
}
