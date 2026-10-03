import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";
import { getSellerByUserId, getSellerProducts } from "@/lib/data/seller";
import { deleteProductAction, toggleProductActiveAction } from "@/lib/actions/seller";
import { Button } from "@/components/ui/button";
import { SellerProductRow } from "@/components/seller/seller-product-row";
import { BecomeSellerForm } from "@/app/vendedor/become-seller-form";

export const metadata: Metadata = { title: "Meus produtos" };

export default async function SellerProductsPage() {
  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);
  if (!seller) return <BecomeSellerForm />;

  const products = await getSellerProducts(seller.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Meus produtos</h1>
          <p className="text-sm text-muted-foreground">{products.length} produtos cadastrados</p>
        </div>
        <Button asChild>
          <Link href="/vendedor/produtos/novo">
            <Plus className="size-4" /> Novo produto
          </Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Package className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Você ainda não cadastrou nenhum produto.</p>
          <Button asChild className="mt-2">
            <Link href="/vendedor/produtos/novo">Cadastrar primeiro produto</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border px-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Produto</th>
                <th className="py-3 pr-4 font-medium">Preço</th>
                <th className="py-3 pr-4 font-medium">Estoque</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <SellerProductRow
                  key={product.id}
                  editHref={`/vendedor/produtos/${product.id}`}
                  deleteAction={deleteProductAction}
                  toggleActiveAction={toggleProductActiveAction}
                  product={{
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    sku: product.sku,
                    priceCents: product.priceCents,
                    isActive: product.isActive,
                    imageUrl: product.images[0]?.url ?? "/placeholders/ph-0.svg",
                    stock: product.inventory?.quantity ?? 0,
                    categoryName: product.category.name,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
