"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";

import { deleteProductAction, toggleProductActiveAction } from "@/lib/actions/seller";
import { formatCurrencyBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  priceCents: number;
  isActive: boolean;
  imageUrl: string;
  stock: number;
  categoryName: string;
};

export function SellerProductRow({ product }: { product: Row }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Remover "${product.name}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      await deleteProductAction(product.id);
      router.refresh();
    });
  }

  function handleToggle() {
    startTransition(async () => {
      await toggleProductActiveAction(product.id);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl} alt="" className="size-12 rounded-md object-cover" />
          <div>
            <p className="text-sm font-medium text-foreground">{product.name}</p>
            <p className="text-xs text-muted-foreground">SKU: {product.sku} · {product.categoryName}</p>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4 text-sm text-foreground">{formatCurrencyBRL(product.priceCents)}</td>
      <td className="py-3 pr-4 text-sm text-foreground">{product.stock}</td>
      <td className="py-3 pr-4">
        <Badge variant={product.isActive ? "success" : "secondary"}>
          {product.isActive ? "Ativo" : "Inativo"}
        </Badge>
      </td>
      <td className="py-3 text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" disabled={isPending} onClick={handleToggle} aria-label="Ativar/desativar">
            {product.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/vendedor/produtos/${product.id}`} aria-label="Editar">
              <Pencil className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={handleDelete}
            className="text-destructive hover:bg-destructive/10"
            aria-label="Remover"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
