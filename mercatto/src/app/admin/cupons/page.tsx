import type { Metadata } from "next";

import { getAdminCoupons } from "@/lib/data/admin";
import { toggleCouponActiveAction } from "@/lib/actions/admin";
import { formatCurrencyBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CouponFormDialog } from "@/components/admin/coupon-form-dialog";
import { ToggleButton } from "@/components/admin/toggle-button";

export const metadata: Metadata = { title: "Cupons" };

export default async function AdminCouponsPage() {
  const coupons = await getAdminCoupons();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Cupons</h1>
          <p className="text-sm text-muted-foreground">{coupons.length} cupons cadastrados</p>
        </div>
        <CouponFormDialog />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border px-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Código</th>
              <th className="py-3 pr-4 font-medium">Desconto</th>
              <th className="py-3 pr-4 font-medium">Usos</th>
              <th className="py-3 pr-4 font-medium">Expira</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.id} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 text-sm font-medium text-foreground">{coupon.code}</td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">
                  {coupon.type === "PERCENTAGE" ? `${coupon.value}%` : formatCurrencyBRL(coupon.value)}
                </td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">
                  {coupon.usedCount}{coupon.maxUses ? `/${coupon.maxUses}` : ""}
                </td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">
                  {coupon.expiresAt ? coupon.expiresAt.toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="py-3 pr-4">
                  <Badge variant={coupon.isActive ? "success" : "secondary"}>
                    {coupon.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="py-3">
                  <ToggleButton action={toggleCouponActiveAction} id={coupon.id}>
                    {coupon.isActive ? "Desativar" : "Ativar"}
                  </ToggleButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
