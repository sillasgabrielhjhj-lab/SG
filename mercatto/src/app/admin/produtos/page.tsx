import type { Metadata } from "next";
import { Eye, EyeOff } from "lucide-react";

import { getAdminProducts } from "@/lib/data/admin";
import { toggleProductActiveAdminAction } from "@/lib/actions/admin";
import { formatCurrencyBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ToggleButton } from "@/components/admin/toggle-button";

export const metadata: Metadata = { title: "Produtos" };

export default async function AdminProductsPage() {
  const products = await getAdminProducts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Produtos</h1>
        <p className="text-sm text-muted-foreground">{products.length} produtos na plataforma</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border px-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Produto</th>
              <th className="py-3 pr-4 font-medium">Vendedor</th>
              <th className="py-3 pr-4 font-medium">Preço</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-border last:border-0">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.images[0]?.url ?? "/placeholders/ph-0.svg"}
                      alt=""
                      className="size-10 rounded-md object-cover"
                    />
                    <div>
                      <p className="text-sm text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category.name}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">{product.seller.storeName}</td>
                <td className="py-3 pr-4 text-sm text-foreground">{formatCurrencyBRL(product.priceCents)}</td>
                <td className="py-3 pr-4">
                  <Badge variant={product.isActive ? "success" : "secondary"}>
                    {product.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="py-3">
                  <ToggleButton action={toggleProductActiveAdminAction} id={product.id}>
                    {product.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {product.isActive ? "Desativar" : "Ativar"}
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
