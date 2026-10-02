"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";

import { updateCartItemQuantityAction, removeCartItemAction } from "@/lib/actions/cart";
import { formatCurrencyBRL } from "@/lib/utils";

type CartItemData = {
  id: string;
  quantity: number;
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl: string;
  variantName: string | null;
  sellerName: string;
  unitPriceCents: number;
  availableStock: number;
};

export function CartItemRow({ item }: { item: CartItemData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const maxQuantity = Math.min(item.availableStock, 10);

  function changeQuantity(next: number) {
    startTransition(async () => {
      await updateCartItemQuantityAction(item.id, next);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCartItemAction(item.id);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-4 border-b border-border py-5 last:border-0">
      <Link href={`/produto/${item.productSlug}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.productName} className="size-20 rounded-md object-cover sm:size-24" />
      </Link>

      <div className="flex flex-1 flex-col gap-1">
        <Link href={`/produto/${item.productSlug}`} className="text-sm font-medium text-foreground hover:text-primary">
          {item.productName}
        </Link>
        {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
        <p className="text-xs text-muted-foreground">Vendido por {item.sellerName}</p>

        <div className="mt-2 flex items-center gap-4">
          <div className="flex items-center rounded-md border border-input">
            <button
              type="button"
              disabled={isPending}
              onClick={() => changeQuantity(item.quantity - 1)}
              className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Diminuir quantidade"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-7 text-center text-sm">{item.quantity}</span>
            <button
              type="button"
              disabled={isPending || item.quantity >= maxQuantity}
              onClick={() => changeQuantity(item.quantity + 1)}
              className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Aumentar quantidade"
            >
              <Plus className="size-3" />
            </button>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={remove}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Remover
          </button>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-display text-sm font-semibold text-foreground">
          {formatCurrencyBRL(item.unitPriceCents * item.quantity)}
        </p>
        {item.quantity > 1 && (
          <p className="text-xs text-muted-foreground">{formatCurrencyBRL(item.unitPriceCents)} un.</p>
        )}
      </div>
    </div>
  );
}
