import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/guards";
import { getCouponForEdit } from "@/features/marketing/queries";
import { CouponForm } from "@/features/marketing/components/coupon-form";
import { couponState } from "@/features/marketing/components/marketing-ui";
import { getCategoryOptions, orNotFound, resolveMarketingOwner, toCouponInitial } from "@/features/marketing/components/form-data.server";

export const metadata = { title: "Cupom" };

/** Cupons da plataforma são editáveis; os de lojas abrem em modo leitura (admin só ativa/desativa). */
export default async function AdminEditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermissionPage("admin:marketing", `/admin/cupons/${id}`);
  const owner = await resolveMarketingOwner("coupon", id);
  if (!owner) notFound();
  const [categories, coupon] = await Promise.all([getCategoryOptions(), orNotFound(getCouponForEdit(owner.scope, id))]);
  return (
    <CouponForm
      key={coupon.id}
      mode="admin"
      basePath="/admin/cupons"
      couponId={coupon.id}
      initial={await toCouponInitial(coupon)}
      categories={categories}
      state={couponState(coupon)}
      usedCount={coupon.usedCount}
      storeName={owner.storeName}
      readOnlyReason={owner.scope.kind === "store" ? `Cupom criado pela loja ${owner.storeName ?? ""}. A administração pode apenas ativá-lo ou desativá-lo (moderação).` : undefined}
    />
  );
}
