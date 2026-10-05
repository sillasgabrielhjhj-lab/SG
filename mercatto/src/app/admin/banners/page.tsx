import { requirePermissionPage } from "@/server/auth/guards";
import { listBannersAdmin } from "@/features/admin/queries";
import { BannerManager } from "@/features/admin/components/catalog-managers";
import { PageHeading } from "@/components/layout/page-heading";

export const metadata = { title: "Banners" };

export default async function AdminBannersPage() {
  await requirePermissionPage("admin:content", "/admin/banners");
  const banners = await listBannersAdmin();
  const now = new Date();
  return (
    <div>
      <PageHeading title="Banners" description="Vitrine da home e das categorias. Banners respeitam o período de exibição automaticamente." />
      <BannerManager
        rows={banners.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, eyebrow: b.eyebrow, ctaLabel: b.ctaLabel, link: b.link, imageUrl: b.imageUrl, mobileImageUrl: b.mobileImageUrl, theme: b.theme, placement: b.placement, position: b.position, startsAt: b.startsAt?.toISOString() ?? null, endsAt: b.endsAt?.toISOString() ?? null, isActive: b.isActive, live: b.isActive && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt > now) }))}
      />
    </div>
  );
}
