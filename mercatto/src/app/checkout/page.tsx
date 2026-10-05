import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserPage } from "@/server/auth/guards";
import { getCartView } from "@/features/cart/queries";
import { getCheckoutPageData } from "@/features/checkout/queries";
import { privateMetadata } from "@/features/seo/metadata";
import { CheckoutFlow } from "@/features/checkout/components/checkout-flow";

export const metadata: Metadata = privateMetadata("Finalizar compra");

export default async function CheckoutPage() {
  const user = await requireUserPage("/checkout");
  const [cart, data] = await Promise.all([getCartView({ userId: user.id }), getCheckoutPageData(user.id)]);
  if (!cart.canCheckout) redirect("/carrinho");
  return (
    <>
      <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">Finalizar compra</h1>
      <CheckoutFlow
        cart={cart}
        user={{ name: data.user?.name ?? user.name, email: data.user?.email ?? user.email, cpf: data.user?.cpf ?? null, phone: data.user?.phone ?? null }}
        addresses={data.addresses.map((a) => ({ id: a.id, label: a.label, recipientName: a.recipientName, phone: a.phone, cep: a.cep, street: a.street, number: a.number, complement: a.complement, district: a.district, city: a.city, state: a.state, isDefault: a.isDefault }))}
        installmentConfig={data.installmentConfig}
        pixDiscountPercent={data.pixDiscountPercent}
        reservationMinutes={data.reservationMinutes}
        gateway={data.gateway}
      />
    </>
  );
}
