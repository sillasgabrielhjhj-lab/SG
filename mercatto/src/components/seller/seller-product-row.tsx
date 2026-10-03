"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff, Star } from "lucide-react";

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
  isFeatured?: boolean;
  imageUrl: string;
  stock: number;
  categoryName: string;
};

/** Linha de produto reaproveitada entre /vendedor/produtos (vendedor
 * externo, sempre dono dos próprios produtos) e /admin/produtos-mercatto
 * (admin, produtos do vendedor oficial) — só as actions e o link de edição
 * mudam entre os dois contextos. */
export function SellerProductRow({
  product,
  editHref,
  deleteAction,
  toggleActiveAction,
  toggleFeaturedAction,
}: {
  product: Row;
  editHref: string;
  deleteAction: (productId: string) => Promise<void>;
  toggleActiveAction: (productId: string) => Promise<void>;
  toggleFeaturedAction?: (productId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Remover "${product.name}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      await deleteAction(product.id);
      router.refresh();
    });
  }

  function handleToggle() {
    startTransition(async () => {
      await toggleActiveAction(product.id);
      router.refresh();
    });
  }

  function handleToggleFeatured() {
    if (!toggleFeaturedAction) return;
    startTransition(async () => {
      await toggleFeaturedAction(product.id);
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
          {toggleFeaturedAction && (
            <Button
              variant="ghost"
              size="icon"
              disabled={isPending}
              onClick={handleToggleFeatured}
              aria-label="Destacar na home"
              className={product.isFeatured ? "text-warning" : undefined}
            >
              <Star className={`size-4 ${product.isFeatured ? "fill-warning" : ""}`} />
            </Button>
          )}
          <Button variant="ghost" size="icon" disabled={isPending} onClick={handleToggle} aria-label="Ativar/desativar">
            {product.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href={editHref} aria-label="Editar">
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
