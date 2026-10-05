import "server-only";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { getPaymentGateway } from "@/server/providers/payments";
import { getStoreSettings } from "@/features/settings/queries";
import { effectiveInstallmentConfig } from "@/features/checkout/installments";
import { releaseCheckout } from "@/features/payments/service";

/** Dados iniciais da página de checkout (o carrinho e totais vêm de getCartView). */
export async function getCheckoutPageData(userId: string) {
  const [user, addresses, settings] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, cpf: true, phone: true, emailVerifiedAt: true } }),
    db.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    getStoreSettings(),
  ]);
  const gateway = getPaymentGateway();
  return {
    user,
    addresses,
    installmentConfig: effectiveInstallmentConfig(settings),
    pixDiscountPercent: settings.pixDiscountPercent,
    reservationMinutes: settings.orderReservationMinutes,
    gateway: { name: gateway.name, isSandbox: gateway.isSandbox, supportsMethods: gateway.supportsMethods, publicKey: gateway.publicKey ?? null },
  };
}

/** Página de pagamento/confirmação: somente o dono enxerga (escopo por userId). */
export async function getCheckoutForPayment(userId: string, checkoutId: string) {
  let checkout = await db.checkout.findFirst({
    where: { id: checkoutId, userId },
    select: {
      id: true,
      status: true,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      totalCents: true,
      couponCode: true,
      paymentMethod: true,
      installments: true,
      expiresAt: true,
      createdAt: true,
      shippingAddress: true,
      payments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, method: true, amountCents: true, installments: true, pixQrCode: true, pixQrCodeImage: true, pixExpiresAt: true, cardBrand: true, cardLast4: true, failureReason: true, isSandbox: true, paidAt: true, createdAt: true },
      },
      orders: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          number: true,
          status: true,
          totalCents: true,
          shippingCents: true,
          shippingService: true,
          shippingEtaDays: true,
          store: { select: { name: true, slug: true, isOfficial: true } },
          items: { select: { id: true, productName: true, variantName: true, imageUrl: true, quantity: true, unitPriceCents: true, totalCents: true } },
        },
      },
    },
  });
  if (!checkout) throw notFound("Compra não encontrada.");
  // Expiração sob demanda (não depende só do cron).
  if (checkout.status === "PENDING_PAYMENT" && checkout.expiresAt.getTime() <= Date.now()) {
    await releaseCheckout(checkout.id, { reason: "Pagamento não realizado no prazo", finalStatus: "EXPIRED" });
    checkout = (await getCheckoutForPayment(userId, checkoutId)) as typeof checkout;
  }
  const gateway = getPaymentGateway();
  return { ...checkout, currentPayment: checkout.payments[0] ?? null, gateway: { name: gateway.name, isSandbox: gateway.isSandbox, publicKey: gateway.publicKey ?? null } };
}

export type CheckoutPaymentData = Awaited<ReturnType<typeof getCheckoutForPayment>>;
