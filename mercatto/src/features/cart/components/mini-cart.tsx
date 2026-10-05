"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { Drawer } from "@/components/ui/drawer";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartIndicator } from "@/components/providers/cart-indicator";
import { ProductImage } from "@/components/commerce/product-image";
import { getMiniCartAction, removeCartItemAction } from "@/features/cart/actions";

type MiniCartData = Extract<Awaited<ReturnType<typeof getMiniCartAction>>, { ok: true }>["data"];

/** Mini-carrinho: abre ao adicionar um produto; resumo rápido + atalho para o carrinho. */
export function MiniCart() {
  const { miniCartOpen, closeMiniCart, setCount } = useCartIndicator();
  const [data, setData] = useState<MiniCartData | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!miniCartOpen) return;
    start(async () => {
      const res = await getMiniCartAction();
      if (res.ok) {
        setData(res.data);
        setCount(res.data.count);
      }
    });
  }, [miniCartOpen, setCount]);

  return (
    <Drawer
      open={miniCartOpen}
      onClose={closeMiniCart}
      title={`Carrinho${data ? ` (${data.count})` : ""}`}
      footer={
        data && data.lines.length ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-fg-muted">Subtotal</span>
              <span className="text-lg font-bold tabular">{formatBRL(data.subtotalCents)}</span>
            </div>
            <ButtonLink href="/carrinho" onClick={closeMiniCart} fullWidth size="lg">
              Ver carrinho e finalizar
            </ButtonLink>
            <button type="button" onClick={closeMiniCart} className="text-sm font-semibold text-brand-700 hover:underline">
              Continuar comprando
            </button>
          </div>
        ) : null
      }
    >
      {!data && pending ? (
        <div className="flex flex-col gap-4 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-16 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.lines.length === 0 ? (
        <EmptyState icon={<ShoppingCart />} title="Seu carrinho está vazio" description="Explore as ofertas e adicione produtos." action={<ButtonLink href="/ofertas" onClick={closeMiniCart}>Ver ofertas</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line">
          {data?.lines.map((l) => (
            <li key={l.itemId} className="flex gap-3 p-4">
              <Link href={`/produto/${l.productSlug}`} onClick={closeMiniCart} className="shrink-0">
                <ProductImage src={l.imageUrl} alt={l.productName} className="size-16 rounded-md border border-line" sizes="64px" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/produto/${l.productSlug}`} onClick={closeMiniCart} className="line-clamp-2 text-sm hover:text-brand-700">
                  {l.productName}
                </Link>
                <p className="text-xs text-fg-muted">
                  {l.variantName !== "Padrão" ? `${l.variantName} · ` : ""}
                  {l.quantity} un.
                </p>
                {l.status !== "OK" ? <p className="text-xs font-semibold text-danger-700">Revise este item no carrinho</p> : null}
                <p className="mt-1 text-sm font-bold tabular">{formatBRL(l.unitPriceCents * l.quantity)}</p>
              </div>
              <button
                type="button"
                aria-label={`Remover ${l.productName}`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-fg-subtle hover:bg-danger-50 hover:text-danger-700 focus-ring"
                onClick={() =>
                  start(async () => {
                    const res = await removeCartItemAction({ itemId: l.itemId });
                    if (res.ok) {
                      setCount(res.data.count);
                      const refreshed = await getMiniCartAction();
                      if (refreshed.ok) setData(refreshed.data);
                    }
                  })
                }
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
