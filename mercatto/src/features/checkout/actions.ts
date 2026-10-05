"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requireUser } from "@/server/auth/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { checkoutIdSchema, checkoutInputSchema } from "@/features/checkout/schemas";
import { buildCheckoutQuote, cancelPendingCheckout, createCheckout, retryPayment } from "@/features/checkout/service";
import { reconcilePayment } from "@/features/payments/service";
import { quoteForLines } from "@/features/shipping/service";
import { priceLines } from "@/features/cart/pricing.server";

export const createCheckoutAction = createAction(checkoutInputSchema, async (input) => {
  const user = await requireUser();
  await enforceRateLimit(`checkout:${user.id}`, 10, 10 * 60);
  const result = await createCheckout(user.id, input);
  revalidatePath("/carrinho");
  revalidatePath("/minha-conta/pedidos");
  return ok(result, "Pedido criado!");
}, "checkout.create");

/** Opções de frete por loja para os itens selecionados e o CEP do endereço escolhido. */
export const quoteCheckoutShippingAction = createAction(z.object({ addressId: z.string().min(1).max(64) }), async ({ addressId }) => {
  const user = await requireUser();
  await enforceRateLimit(`checkout-ship:${user.id}`, 60, 60);
  const address = await db.address.findFirst({ where: { id: addressId, userId: user.id }, select: { cep: true, state: true } });
  if (!address) throw notFound("Endereço não encontrado.");
  const cart = await db.cart.findUnique({ where: { userId: user.id }, select: { items: { where: { selected: true }, select: { variantId: true, quantity: true } } } });
  const lines = (await priceLines(cart?.items ?? [])).filter((l) => l.availability === "AVAILABLE");
  return ok(await quoteForLines(lines, address.cep, address.state));
}, "checkout.quote_shipping");

/** Revisão: resumo final calculado no servidor para os dados escolhidos. */
export const reviewCheckoutAction = createAction(
  z.object({
    addressId: z.string().min(1).max(64),
    shippingSelections: z.record(z.string().max(64), z.string().max(120)),
    paymentMethod: z.enum(["PIX", "CREDIT_CARD"]),
    installments: z.coerce.number().int().min(1).max(24).default(1),
  }),
  async (input) => {
    const user = await requireUser();
    await enforceRateLimit(`checkout-review:${user.id}`, 60, 60);
    const { quote } = await buildCheckoutQuote(user.id, input);
    return ok({
      totals: quote.totals,
      installments: quote.installments,
      coupon: quote.coupon,
      stores: quote.stores.map((s) => ({
        storeId: s.storeId,
        storeName: s.storeName,
        isOfficial: s.isOfficial,
        subtotalCents: s.subtotalCents,
        shipping: s.shipping,
        shippingDiscountCents: s.shippingDiscountCents,
        couponDiscountCents: s.couponDiscountCents,
        pixDiscountCents: s.pixDiscountCents,
        totalCents: s.totalCents,
        lines: s.lines.map((l) => ({ variantId: l.variantId, productName: l.productName, variantName: l.variantName, imageUrl: l.imageUrl, quantity: l.quantity, unitPriceCents: l.unitPriceCents, lineTotalCents: l.lineTotalCents })),
      })),
    });
  },
  "checkout.review",
);

export const retryPaymentAction = createAction(
  checkoutIdSchema.extend({
    method: z.enum(["PIX", "CREDIT_CARD"]),
    installments: z.coerce.number().int().min(1).max(24).default(1),
    cardToken: z.string().max(500).optional(),
    cardPaymentMethodId: z.string().max(40).optional(),
    cardIssuerId: z.string().max(40).optional(),
  }),
  async ({ checkoutId, ...input }) => {
    const user = await requireUser();
    await enforceRateLimit(`retry-pay:${user.id}`, 10, 10 * 60);
    const result = await retryPayment(user.id, checkoutId, input);
    revalidatePath(`/checkout/pagamento/${checkoutId}`);
    return ok(result);
  },
  "checkout.retry_payment",
);

/** Polling da página de pagamento (PIX): status atual da compra do próprio usuário. */
export const getCheckoutStatusAction = createAction(checkoutIdSchema, async ({ checkoutId }) => {
  const user = await requireUser();
  const checkout = await db.checkout.findFirst({
    where: { id: checkoutId, userId: user.id },
    select: { status: true, expiresAt: true, payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, failureReason: true, provider: true, providerPaymentId: true } } },
  });
  if (!checkout) throw notFound("Compra não encontrada.");
  let latest = checkout.payments[0];
  let status = checkout.status;
  // Enquanto o cliente aguarda, confirma direto no gateway (cobre webhook atrasado/perdido).
  if (status === "PENDING_PAYMENT" && latest?.status === "PENDING") {
    const reconciled = await reconcilePayment(latest);
    if (reconciled && reconciled !== "PENDING") {
      const fresh = await db.checkout.findUniqueOrThrow({ where: { id: checkoutId }, select: { status: true, payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, failureReason: true, provider: true, providerPaymentId: true } } } });
      status = fresh.status;
      latest = fresh.payments[0];
    }
  }
  return ok({ status, paymentStatus: latest?.status ?? null, failureReason: latest?.failureReason ?? null, expiresAt: checkout.expiresAt.toISOString() });
}, "checkout.status");

export const cancelPendingCheckoutAction = createAction(checkoutIdSchema, async ({ checkoutId }) => {
  const user = await requireUser();
  await cancelPendingCheckout(user.id, checkoutId);
  revalidatePath("/minha-conta/pedidos");
  return ok(undefined, "Compra cancelada. Os itens foram liberados.");
}, "checkout.cancel");

