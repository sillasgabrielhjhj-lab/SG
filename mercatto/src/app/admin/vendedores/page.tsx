import type { Metadata } from "next";
import { ShieldCheck, ShieldX } from "lucide-react";

import { getAdminSellers } from "@/lib/data/admin";
import { toggleSellerVerifiedAction } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { ToggleButton } from "@/components/admin/toggle-button";

export const metadata: Metadata = { title: "Vendedores" };

export default async function AdminSellersPage() {
  const sellers = await getAdminSellers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Vendedores</h1>
        <p className="text-sm text-muted-foreground">{sellers.length} lojas cadastradas</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border px-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Loja</th>
              <th className="py-3 pr-4 font-medium">Dono</th>
              <th className="py-3 pr-4 font-medium">Produtos</th>
              <th className="py-3 pr-4 font-medium">Avaliação</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller) => (
              <tr key={seller.id} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 text-sm font-medium text-foreground">{seller.storeName}</td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">{seller.user.email}</td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">{seller._count.products}</td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">
                  {seller.ratingAvg.toFixed(1)} ★ ({seller.ratingCount})
                </td>
                <td className="py-3 pr-4">
                  {seller.isVerified ? (
                    <Badge variant="success">Verificado</Badge>
                  ) : (
                    <Badge variant="secondary">Não verificado</Badge>
                  )}
                </td>
                <td className="py-3">
                  <ToggleButton action={toggleSellerVerifiedAction} id={seller.id}>
                    {seller.isVerified ? <ShieldX className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                    {seller.isVerified ? "Remover verificação" : "Verificar"}
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
