"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, BadgeCheck, Heart, Lock, ShoppingCart, Store, Tag, Trash2, Truck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import type { CartView } from "@/features/cart/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useToast } from "@/components/ui/toast";
import { useCartIndicator } from "@/components/providers/cart-indicator";
import { ProductImage } from "@/components/commerce/product-image";
import { DiscountBadge, FlashBadge, OfficialBadge } from "@/components/commerce/badges";
import { trackEvent } from "@/lib/analytics";
import { applyCouponAction, moveToWishlistAction, removeCartItemAction, removeCouponAction, toggleCartItemSelectionAction, updateCartItemAction } from "@/features/cart/actions";

export function CartPageView({ cart, isLoggedIn }: { cart: CartView; isLoggedIn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { setCount } = useCartIndicator();
  const [pending, start] = useTransition();
  const [coupon, setCoupon] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown; message?: string }>, success?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Não foi possível atualizar o carrinho.");
      else {
        const count = (res.data as { count?: number } | undefined)?.count;
        if (typeof count === "number") setCount(count);
        if (success ?? res.message) toast.success(success ?? res.message!);
      }
      router.refresh();
    });

  if (cart.distinctCount === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title="Seu carrinho está esperando por boas escolhas."
        description="Explore as ofertas de hoje — e os produtos que você favoritar ficam salvos para depois."
        action={
          <>
            <ButtonLink href="/ofertas">Explorar ofertas</ButtonLink>
            {isLoggedIn ? <ButtonLink href="/minha-conta/favoritos" variant="outline">Meus favoritos</ButtonLink> : null}
          </>
        }
      />
    );
  }

  const allSelected = cart.groups.every((g) => g.lines.every((l) => l.selected || l.status === "UNAVAILABLE"));
  const checkoutHref = isLoggedIn ? "/checkout" : `/entrar?redirect=${encodeURIComponent("/checkout")}`;

  return (
    <div className={cn("grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]", pending && "cursor-progress")}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={allSelected} onChange={(e) => run(() => toggleCartItemSelectionAction({ itemIds: "all", selected: e.target.checked }))} className="size-[18px] accent-[var(--color-brand-700)]" />
            Selecionar todos ({cart.distinctCount})
          </label>
          <span className="text-xs text-fg-muted">{cart.count} {cart.count === 1 ? "unidade" : "unidades"}</span>
        </div>

        {cart.groups.map((group) => (
          <section key={group.store.id} aria-label={`Produtos de ${group.store.name}`} className="overflow-hidden rounded-card border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-muted px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Store className="size-4 text-brand-700" aria-hidden />
                {group.store.isOfficial ? "Mercatto" : group.store.name}
                {group.store.isOfficial ? <OfficialBadge compact /> : null}
              </span>
              {group.freeShipping ? (
                group.freeShipping.reached ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-success-700">
                    <Truck className="size-4" aria-hidden /> Você ganhou frete grátis!
                  </span>
                ) : (
                  <span className="text-xs text-fg-muted">
                    Faltam <strong className="text-fg">{formatBRL(group.freeShipping.remainingCents)}</strong> para frete grátis
                  </span>
                )
              ) : null}
            </header>
            {group.freeShipping && !group.freeShipping.reached ? (
              <div className="h-1 bg-line" aria-hidden>
                <div className="h-full bg-brand-600 transition-[width] duration-500" style={{ width: `${Math.min(100, ((group.freeShipping.thresholdCents - group.freeShipping.remainingCents) / group.freeShipping.thresholdCents) * 100)}%` }} />
              </div>
            ) : null}
            <ul className="divide-y divide-line">
              {group.lines.map((line) => (
                <li key={line.itemId} className={cn("flex gap-3 p-4", line.status === "UNAVAILABLE" && "bg-surface-muted/60")}>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${line.productName}`}
                    checked={line.selected && line.status !== "UNAVAILABLE"}
                    disabled={line.status === "UNAVAILABLE"}
                    onChange={(e) => run(() => toggleCartItemSelectionAction({ itemIds: [line.itemId], selected: e.target.checked }))}
                    className="mt-1 size-[18px] shrink-0 accent-[var(--color-brand-700)]"
                  />
                  <Link href={`/produto/${line.productSlug}`} className="shrink-0">
                    <ProductImage src={line.imageUrl} alt={line.imageAlt} className={cn("size-20 rounded-md border border-line sm:size-24", line.status === "UNAVAILABLE" && "opacity-50 grayscale")} sizes="96px" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/produto/${line.productSlug}`} className="line-clamp-2 text-sm font-medium hover:text-brand-700">
                        {line.productName}
                      </Link>
                      {line.variantName !== "Padrão" ? <p className="text-xs text-fg-muted">{line.variantName}</p> : null}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {line.promotion?.isFlash ? <FlashBadge label="Relâmpago" /> : null}
                        {line.discountPercent >= 5 ? <DiscountBadge percent={line.discountPercent} /> : null}
                      </div>
                      {line.alerts.map((a) => (
                        <p key={a.type} className={cn("mt-1 flex items-center gap-1 text-xs font-semibold", a.type === "PROMOTION_LOW_STOCK" ? "text-sun-700" : "text-danger-700")}>
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          {a.message}
                          {a.suggestedQuantity ? (
                            <button type="button" className="ml-1 underline" onClick={() => run(() => updateCartItemAction({ itemId: line.itemId, quantity: a.suggestedQuantity! }))}>
                              Ajustar para {a.suggestedQuantity}
                            </button>
                          ) : null}
                        </p>
                      ))}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                        <button type="button" onClick={() => (trackEvent("remove_from_cart", { item_name: line.productName }), run(() => removeCartItemAction({ itemId: line.itemId }), "Produto removido"))} className="inline-flex items-center gap-1 text-fg-muted hover:text-danger-700 focus-ring">
                          <Trash2 className="size-3.5" aria-hidden /> Excluir
                        </button>
                        {isLoggedIn ? (
                          <button type="button" onClick={() => run(() => moveToWishlistAction({ itemId: line.itemId }))} className="inline-flex items-center gap-1 text-fg-muted hover:text-brand-700 focus-ring">
                            <Heart className="size-3.5" aria-hidden /> Salvar para depois
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
                      {line.status !== "UNAVAILABLE" ? (
                        <QuantityStepper size="sm" value={line.quantity} max={Math.max(1, line.maxQuantity)} disabled={pending} onChange={(q) => run(() => updateCartItemAction({ itemId: line.itemId, quantity: q }))} label={`Quantidade de ${line.productName}`} />
                      ) : (
                        <span className="text-xs font-semibold text-fg-muted">Indisponível</span>
                      )}
                      <div className="text-right">
                        {line.listPriceCents && line.listPriceCents > line.unitPriceCents ? <p className="text-xs text-fg-subtle line-through tabular">{formatBRL(line.listPriceCents * line.quantity)}</p> : null}
                        <p className="text-base font-bold tabular">{formatBRL(line.lineTotalCents)}</p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
          <h2 className="text-base font-bold">Resumo da compra</h2>
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Tag className="size-4 text-brand-700" aria-hidden /> Cupom de desconto
            </span>
            {cart.coupon ? (
              <div className={cn("flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm", cart.coupon.ok ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700")}>
                <span className="min-w-0">
                  <strong>{cart.coupon.code}</strong>
                  <span className="block text-xs">{cart.coupon.message}</span>
                </span>
                <button type="button" onClick={() => run(() => removeCouponAction())} className="grid size-8 place-items-center rounded-full hover:bg-black/5 focus-ring" aria-label="Remover cupom">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const res = await applyCouponAction({ code: coupon });
                    if (!res.ok) setCouponError(res.error);
                    else {
                      setCouponError(null);
                      setCoupon("");
                      trackEvent("coupon_applied", { coupon: res.data.code });
                      toast.success(res.message ?? "Cupom aplicado!");
                      router.refresh();
                    }
                  });
                }}
                className="flex gap-2"
              >
                <label htmlFor="coupon" className="sr-only">
                  Código do cupom
                </label>
                <Input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Digite o código" aria-invalid={couponError ? true : undefined} className="uppercase" />
                <Button type="submit" variant="outline" disabled={coupon.trim().length < 2} loading={pending && Boolean(coupon)}>
                  Aplicar
                </Button>
              </form>
            )}
            {couponError ? (
              <p role="alert" className="text-xs font-medium text-danger-700">
                {couponError}
              </p>
            ) : null}
          </div>
          <dl className="flex flex-col gap-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-muted">Produtos ({cart.totals.itemsCount})</dt>
              <dd className="tabular">{formatBRL(cart.totals.originalSubtotalCents)}</dd>
            </div>
            {cart.totals.promotionSavingsCents > 0 ? (
              <div className="flex justify-between text-success-700">
                <dt>Descontos das ofertas</dt>
                <dd className="tabular">-{formatBRL(cart.totals.promotionSavingsCents)}</dd>
              </div>
            ) : null}
            {cart.totals.couponDiscountCents > 0 ? (
              <div className="flex justify-between text-success-700">
                <dt>Cupom</dt>
                <dd className="tabular">-{formatBRL(cart.totals.couponDiscountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-fg-muted">Frete</dt>
              <dd className="text-fg-muted">Calculado no checkout</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="text-base font-bold">Total</dt>
              <dd className="text-xl font-extrabold tabular">{formatBRL(cart.totals.totalCents)}</dd>
            </div>
          </dl>
          {cart.blockers.length ? (
            <Alert tone="warning">
              {cart.blockers.map((b) => (
                <span key={b} className="block">
                  {b}
                </span>
              ))}
            </Alert>
          ) : null}
          <ButtonLink href={checkoutHref} size="lg" fullWidth aria-disabled={!cart.canCheckout} onClick={() => trackEvent("begin_checkout", { value: cart.totals.totalCents / 100 })} className={!cart.canCheckout ? "pointer-events-none opacity-50" : undefined}>
            Continuar a compra
          </ButtonLink>
          <p className="flex items-center justify-center gap-1.5 text-xs text-fg-muted">
            <Lock className="size-3.5" aria-hidden /> Pagamento seguro · <BadgeCheck className="size-3.5" aria-hidden /> Compra garantida
          </p>
        </div>
      </aside>
    </div>
  );
}
