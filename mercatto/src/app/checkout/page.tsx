import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { requireUser } from "@/lib/auth/guards";
import { getCartForUser } from "@/lib/data/cart";
import { prisma } from "@/lib/prisma";
import { CheckoutWizard } from "@/components/checkout/checkout-wizard";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser();

  const [cart, addresses] = await Promise.all([
    getCartForUser(user.id),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
  ]);

  if (cart.items.length === 0) {
    redirect("/carrinho");
  }

  const items = cart.items.map((item) => ({
    id: item.id,
    productName: item.product.name,
    variantName: item.variant?.name ?? null,
    imageUrl: item.product.images[0]?.url ?? "/placeholders/ph-0.svg",
    quantity: item.quantity,
    unitPriceCents: item.variant?.priceCents ?? item.product.priceCents,
  }));

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container-page max-w-3xl py-6">
          <h1 className="mb-6 font-display text-2xl font-bold text-foreground sm:text-3xl">
            Finalizar compra
          </h1>
          <CheckoutWizard addresses={addresses} items={items} coupon={cart.coupon} />
        </div>
      </main>
      <Footer />
    </>
  );
}
