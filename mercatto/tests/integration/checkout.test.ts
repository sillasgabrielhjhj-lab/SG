import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createCheckout, expireStaleCheckouts } from "@/features/checkout/service";
import { applyPaymentStatus } from "@/features/payments/service";
import { processPaymentWebhook } from "@/features/payments/webhook.server";
import { createDevWebhookRequest } from "@/server/providers/payments/dev";
import { quoteForLines } from "@/features/shipping/service";
import { priceLines } from "@/features/cart/pricing.server";
import { createAddress, createProduct, createStore, createUser, ensureSettings, makeCpf, newKey, putInCart } from "../support/fixtures";

async function prepareBuyer(variantId: string, quantity = 1) {
  const user = await createUser();
  const address = await createAddress(user.id);
  await putInCart(user.id, variantId, quantity);
  const lines = await priceLines([{ variantId, quantity }]);
  const [quote] = await quoteForLines(lines, address.cep, address.state);
  return { user, address, shippingSelections: { [quote!.storeId]: quote!.options[0]!.id } };
}

const pix = (b: Awaited<ReturnType<typeof prepareBuyer>>, key = newKey()) => ({
  idempotencyKey: key,
  addressId: b.address.id,
  shippingSelections: b.shippingSelections,
  paymentMethod: "PIX" as const,
  installments: 1,
  customer: { cpf: makeCpf(), phone: "11987654321" },
});

describe("checkout", () => {
  beforeAll(async () => {
    await ensureSettings({ minOrderCents: 0, freeShippingThresholdCents: null, pixDiscountPercent: 0, orderReservationMinutes: 30 });
  });

  it("recalcula preços no servidor e reserva estoque com movimentação", async () => {
    const { store } = await createStore();
    const { variant } = await createProduct({ storeId: store.id, priceCents: 15000, stock: 5 });
    const buyer = await prepareBuyer(variant.id, 2);
    const { checkoutId } = await createCheckout(buyer.user.id, pix(buyer));
    const checkout = await db.checkout.findUniqueOrThrow({ where: { id: checkoutId }, include: { orders: { include: { items: true } }, payments: true } });
    expect(checkout.subtotalCents).toBe(30000);
    expect(checkout.orders).toHaveLength(1);
    expect(checkout.orders[0]!.items[0]!.unitPriceCents).toBe(15000);
    expect(checkout.totalCents).toBe(30000 + checkout.shippingCents);
    expect(checkout.payments[0]!.pixQrCode).toContain("NAO");
    const v = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(v.stock).toBe(3);
    const movements = await db.inventoryMovement.findMany({ where: { variantId: variant.id, type: "SALE" } });
    expect(movements.reduce((s, m) => s + m.quantity, 0)).toBe(-2);
    // Itens comprados saem do carrinho.
    expect(await db.cartItem.count({ where: { cart: { userId: buyer.user.id } } })).toBe(0);
  });

  it("CONCORRÊNCIA: estoque 1 e dois compradores simultâneos => apenas um pedido", async () => {
    const { store } = await createStore();
    const { variant } = await createProduct({ storeId: store.id, stock: 1 });
    const a = await prepareBuyer(variant.id);
    const b = await prepareBuyer(variant.id);
    const results = await Promise.allSettled([createCheckout(a.user.id, pix(a)), createCheckout(b.user.id, pix(b))]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(String(failed[0]!.reason?.code ?? failed[0]!.reason)).toMatch(/OUT_OF_STOCK/);
    const v = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(v.stock).toBe(0);
    expect(await db.order.count({ where: { items: { some: { variantId: variant.id } } } })).toBe(1);
  });

  it("IDEMPOTÊNCIA: o mesmo envio retorna a mesma compra sem baixar estoque duas vezes", async () => {
    const { store } = await createStore();
    const { variant } = await createProduct({ storeId: store.id, stock: 10 });
    const buyer = await prepareBuyer(variant.id, 1);
    const input = pix(buyer);
    // Duplo clique: os dois envios simultâneos devem resolver para a MESMA compra.
    const [first, second] = await Promise.all([createCheckout(buyer.user.id, input), createCheckout(buyer.user.id, input)]);
    const third = await createCheckout(buyer.user.id, input);
    expect(second.checkoutId).toBe(first.checkoutId);
    expect(third.checkoutId).toBe(first.checkoutId);
    expect(await db.checkout.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(9);
  });

  it("cupom com usageLimit 1 usado em paralelo por dois clientes => só um consegue", async () => {
    const { store } = await createStore();
    const { variant } = await createProduct({ storeId: store.id, stock: 10, priceCents: 20000 });
    const coupon = await db.coupon.create({ data: { code: `UNICO${Date.now()}`, type: "PERCENT", value: 10, usageLimit: 1, usageLimitPerUser: 1 } });
    const a = await prepareBuyer(variant.id);
    const b = await prepareBuyer(variant.id);
    await db.cart.updateMany({ where: { userId: { in: [a.user.id, b.user.id] } }, data: { couponCode: coupon.code } });
    const results = await Promise.allSettled([createCheckout(a.user.id, pix(a)), createCheckout(b.user.id, pix(b))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const c = await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(c.usedCount).toBe(1);
    expect(await db.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(1);
  });

  it("pagamento aprovado via webhook assinado: pedidos PAID e vendas contadas uma única vez (webhook duplicado)", async () => {
    const { store } = await createStore();
    const { product, variant } = await createProduct({ storeId: store.id, stock: 10 });
    const buyer = await prepareBuyer(variant.id, 2);
    const { checkoutId } = await createCheckout(buyer.user.id, pix(buyer));
    const payment = await db.payment.findFirstOrThrow({ where: { checkoutId } });
    const signed = await createDevWebhookRequest({ providerPaymentId: payment.providerPaymentId!, status: "PAID", eventId: `evt-${checkoutId}`, amountCents: payment.amountCents });
    const r1 = await processPaymentWebhook("dev", signed);
    const r2 = await processPaymentWebhook("dev", signed);
    expect(r1.status).toBe(200);
    expect(r2.body.message).toMatch(/já processado/i);
    const order = await db.order.findFirstOrThrow({ where: { checkoutId } });
    expect(order.status).toBe("PAID");
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).salesCount).toBe(2);
    // Evento antigo PENDING não regride.
    await applyPaymentStatus({ provider: "dev", providerPaymentId: payment.providerPaymentId!, status: "FAILED" });
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PAID");
  });

  it("rejeita webhook com assinatura inválida e valor divergente", async () => {
    const { store } = await createStore();
    const { variant } = await createProduct({ storeId: store.id, stock: 10 });
    const buyer = await prepareBuyer(variant.id);
    const { checkoutId } = await createCheckout(buyer.user.id, pix(buyer));
    const payment = await db.payment.findFirstOrThrow({ where: { checkoutId } });
    const signed = await createDevWebhookRequest({ providerPaymentId: payment.providerPaymentId!, status: "PAID" });
    const tampered = { ...signed, rawBody: signed.rawBody.replace("PAID", "PAID ") };
    expect((await processPaymentWebhook("dev", tampered)).status).toBe(401);
    const wrongAmount = await createDevWebhookRequest({ providerPaymentId: payment.providerPaymentId!, status: "PAID", amountCents: 1 });
    await processPaymentWebhook("dev", wrongAmount);
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
  });

  it("expiração devolve o estoque exatamente uma vez", async () => {
    const { store } = await createStore();
    const { variant } = await createProduct({ storeId: store.id, stock: 4 });
    const buyer = await prepareBuyer(variant.id, 3);
    const { checkoutId } = await createCheckout(buyer.user.id, pix(buyer));
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(1);
    await db.checkout.update({ where: { id: checkoutId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expireStaleCheckouts();
    await expireStaleCheckouts();
    const payment = await db.payment.findFirstOrThrow({ where: { checkoutId } });
    await applyPaymentStatus({ provider: "dev", providerPaymentId: payment.providerPaymentId!, status: "EXPIRED" });
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(4);
    expect((await db.checkout.findUniqueOrThrow({ where: { id: checkoutId } })).status).toBe("EXPIRED");
    expect((await db.order.findFirstOrThrow({ where: { checkoutId } })).status).toBe("CANCELLED");
  });

  it("cartão de teste recusado mantém a reserva; aprovado confirma na hora", async () => {
    const { store } = await createStore();
    const { variant } = await createProduct({ storeId: store.id, stock: 5 });
    const declined = await prepareBuyer(variant.id);
    const r = await createCheckout(declined.user.id, { ...pix(declined), paymentMethod: "CREDIT_CARD", cardToken: "dev_declined", installments: 1 });
    expect((await db.payment.findFirstOrThrow({ where: { checkoutId: r.checkoutId } })).status).toBe("FAILED");
    expect((await db.checkout.findUniqueOrThrow({ where: { id: r.checkoutId } })).status).toBe("PENDING_PAYMENT");
    const approved = await prepareBuyer(variant.id);
    const r2 = await createCheckout(approved.user.id, { ...pix(approved), paymentMethod: "CREDIT_CARD", cardToken: "dev_approved", installments: 3 });
    expect((await db.checkout.findUniqueOrThrow({ where: { id: r2.checkoutId } })).status).toBe("PAID");
  });
});
