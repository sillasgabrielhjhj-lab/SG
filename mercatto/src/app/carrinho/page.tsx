import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart, ArrowRight } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { requireUser } from "@/lib/auth/guards";
import { getCartForUser, computeCartSummary } from "@/lib/data/cart";
import { formatCurrencyBRL } from "@/lib/utils";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { CouponForm } from "@/components/cart/coupon-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Carrinho" };

export default async function CartPage() {
  const user = await requireUser();
  const cart = await getCartForUser(user.id);

  const items = cart.items.map((item) => {
    const unitPriceCents = item.variant?.priceCents ?? item.product.priceCents;
    const inventory = item.variant?.inventory ?? item.product.inventory;
    const availableStock = inventory ? inventory.quantity - inventory.reserved : 0;

    return {
      id: item.id,
      quantity: item.quantity,
      productId: item.productId,
      productSlug: item.product.slug,
      productName: item.product.name,
      imageUrl: item.product.images[0]?.url ?? "/placeholders/ph-0.svg",
      variantName: item.variant?.name ?? null,
      sellerName: item.product.seller.storeName,
      unitPriceCents,
      availableStock,
    };
  });

  const summary = computeCartSummary(
    items.map((i) => ({ quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
    cart.coupon,
    0,
  );

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container-page py-6">
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Carrinho</h1>

          {items.length === 0 ? (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
              <ShoppingCart className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
              <Button asChild className="mt-2">
                <Link href="/">Continuar comprando</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
              <div className="rounded-xl border border-border px-5">
                {items.map((item) => (
                  <CartItemRow key={item.id} item={item} />
                ))}
              </div>

              <div className="flex h-fit flex-col gap-4 rounded-xl border border-border p-5">
                <h2 className="font-display text-lg font-semibold text-foreground">Resumo do pedido</h2>

                <CouponForm appliedCode={cart.coupon?.code ?? null} />

                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal ({summary.itemCount} {summary.itemCount === 1 ? "item" : "itens"})</span>
                    <span>{formatCurrencyBRL(summary.subtotalCents)}</span>
                  </div>
                  {summary.discountCents > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Desconto</span>
                      <span>-{formatCurrencyBRL(summary.discountCents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Frete</span>
                    <span>Calculado no checkout</span>
                  </div>
                </div>

                <div className="flex justify-between border-t border-border pt-3 font-display text-lg font-bold text-foreground">
                  <span>Total</span>
                  <span>{formatCurrencyBRL(summary.subtotalCents - summary.discountCents)}</span>
                </div>

                <Button asChild size="lg">
                  <Link href="/checkout">
                    Ir para checkout <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/">Continuar comprando</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
