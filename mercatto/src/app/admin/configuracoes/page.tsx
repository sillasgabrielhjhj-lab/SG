import { requirePermissionPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { SettingsForm } from "@/features/admin/components/settings-form";
import { PageHeading } from "@/components/layout/page-heading";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  await requirePermissionPage("admin:settings", "/admin/configuracoes");
  const s = await db.storeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const social = (s.socialLinks as Record<string, string | null> | null) ?? {};
  return (
    <div>
      <PageHeading title="Configurações da loja" description="Alterações ficam registradas na auditoria." />
      <SettingsForm
        initial={{
          storeName: s.storeName,
          tagline: s.tagline ?? "",
          logoUrl: s.logoUrl ?? "",
          faviconUrl: s.faviconUrl ?? "",
          contactEmail: s.contactEmail ?? "",
          contactPhone: s.contactPhone ?? "",
          whatsapp: s.whatsapp ?? "",
          instagram: social.instagram ?? "",
          facebook: social.facebook ?? "",
          tiktok: social.tiktok ?? "",
          youtube: social.youtube ?? "",
          x: social.x ?? "",
          seoTitle: s.seoTitle ?? "",
          seoDescription: s.seoDescription ?? "",
          minOrderCents: s.minOrderCents,
          freeShippingThresholdCents: s.freeShippingThresholdCents,
          lowStockThreshold: s.lowStockThreshold,
          orderReservationMinutes: s.orderReservationMinutes,
          pixDiscountPercent: s.pixDiscountPercent,
          maxInstallments: s.maxInstallments,
          interestFreeInstallments: s.interestFreeInstallments,
          monthlyInterestBps: s.monthlyInterestBps,
          minInstallmentCents: s.minInstallmentCents,
        }}
      />
    </div>
  );
}
