import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { AppError, conflict, notFound } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { getPaymentGateway } from "@/server/providers/payments";
import { MERCADOPAGO_PROVIDER } from "@/server/providers/payments/mercadopago";
import { isProviderError } from "@/server/providers/errors";
import { allocateProportionally, installmentOptions, formatBRL } from "@/lib/money";
import { computeTotals } from "@/features/pricing/engine";
import { getStoreSettings, installmentConfigFrom } from "@/features/settings/queries";
import { groupByStore, priceLines, toCouponLines, type PricedLine } from "@/features/cart/pricing.server";
import { removePurchasedItems } from "@/features/cart/service";
import { validateCouponForLines } from "@/features/coupons/service";
import { quoteForLines } from "@/features/shipping/service";
import { generateOrderNumber } from "@/features/checkout/order-number";
import { applyPaymentStatus, reconcilePayment, releaseCheckout } from "@/features/payments/service";
import { recomputeProductAggregates } from "@/features/catalog/aggregates";
import type { CheckoutInput } from "@/features/checkout/schemas";

/**
 * CHECKOUT — o servidor recalcula TUDO (preços, promoções, frete, cupom,
 * PIX, parcelas) a partir do banco. O cliente envia apenas escolhas
 * (endereço, opção de frete, meio de pagamento); nenhum valor monetário.
 *
 * Concorrência: reserva de estoque por UPDATE condicional atômico dentro de
 * uma transação (stock >= qty). Estoque promocional e limite de cupom usam a
 * mesma técnica. Se qualquer item falhar, nada é gravado.
 */

export type CheckoutQuote = {
  lines: PricedLine[];
  stores: {
    storeId: string;
    storeName: string;
    isOfficial: boolean;
    lines: PricedLine[];
    subtotalCents: number;
    shipping: { optionId: string; service: string; carrier: string | null; priceCents: number; originalPriceCents: number; minDays: number; maxDays: number };
    couponDiscountCents: number;
    shippingDiscountCents: number;
    pixDiscountCents: number;
    totalCents: number;
  }[];
  totals: ReturnType<typeof computeTotals>;
  coupon: { id: string; code: string } | null;
  couponAllocations: Record<string, number>;
  installments: { count: number; installmentCents: number; totalCents: number; interestFree: boolean };
};

/** Monta a cotação completa e validada do checkout (sem gravar nada). */
export async function buildCheckoutQuote(userId: string, input: Pick<CheckoutInput, "addressId" | "shippingSelections" | "paymentMethod" | "installments">) {
  const settings = await getStoreSettings();
  const address = await db.address.findFirst({ where: { id: input.addressId, userId } });
  if (!address) throw new AppError("VALIDATION", "Endereço inválido.", { fieldErrors: { addressId: ["Escolha um endereço válido"] } });

  const cart = await db.cart.findUnique({
    where: { userId },
    select: { couponCode: true, items: { where: { selected: true }, select: { id: true, variantId: true, quantity: true } } },
  });
  if (!cart || cart.items.length === 0) throw new AppError("UNPROCESSABLE", "Seu carrinho está vazio.");
  const lines = await priceLines(cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, itemId: i.id })));
  const problem = lines.find((l) => l.availability !== "AVAILABLE");
  if (problem) throw new AppError("OUT_OF_STOCK", `${problem.productName}: ${problem.availabilityMessage ?? "indisponível"}. Atualize o carrinho.`);
  if (lines.length === 0) throw new AppError("UNPROCESSABLE", "Seu carrinho está vazio.");

  const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  if (settings.minOrderCents > 0 && subtotal < settings.minOrderCents) {
    throw new AppError("UNPROCESSABLE", `O valor mínimo do pedido é ${formatBRL(settings.minOrderCents)}.`);
  }

  // Frete: recotado no servidor; a opção escolhida precisa existir na cotação atual.
  const quotes = await quoteForLines(lines, address.cep, address.state);
  const shippingByStore: Record<string, CheckoutQuote["stores"][number]["shipping"]> = {};
  for (const q of quotes) {
    if (q.error || !q.options.length) throw new AppError("UNPROCESSABLE", `${q.storeName}: ${q.error ?? "entrega indisponível para este CEP"}.`);
    const chosenId = input.shippingSelections[q.storeId];
    const option = q.options.find((o) => o.id === chosenId);
    if (!option) throw new AppError("VALIDATION", `Escolha a forma de entrega de ${q.storeName}.`, { fieldErrors: { shippingSelections: ["Escolha a entrega"] } });
    shippingByStore[q.storeId] = { optionId: option.id, service: option.service, carrier: option.carrier, priceCents: option.priceCents, originalPriceCents: option.originalPriceCents, minDays: option.minDays, maxDays: option.maxDays };
  }
  const shippingTotal = Object.values(shippingByStore).reduce((s, o) => s + o.priceCents, 0);

  // Cupom (estado do servidor: código salvo no carrinho).
  let coupon: CheckoutQuote["coupon"] = null;
  let couponAllocations: Record<string, number> = {};
  let couponDiscount = 0;
  let couponShippingDiscount = 0;
  if (cart.couponCode) {
    const result = await validateCouponForLines({
      code: cart.couponCode,
      userId,
      lines: toCouponLines(lines),
      shippingCents: shippingTotal,
      shippingByStore: Object.fromEntries(Object.entries(shippingByStore).map(([k, v]) => [k, v.priceCents])),
    });
    if (!result.ok) throw new AppError("UNPROCESSABLE", `Cupom ${cart.couponCode}: ${result.reason} Remova o cupom para continuar.`);
    coupon = { id: result.coupon.id, code: result.coupon.code };
    couponAllocations = result.evaluation.allocations;
    couponDiscount = result.evaluation.discountCents;
    couponShippingDiscount = result.evaluation.shippingDiscountCents;
  }

  const totals = computeTotals({
    lines: lines.map((l) => ({ unitPriceCents: l.unitPriceCents, originalPriceCents: l.price.basePriceCents, quantity: l.quantity })),
    shippingCents: shippingTotal,
    couponDiscountCents: couponDiscount,
    couponShippingDiscountCents: couponShippingDiscount,
    pixDiscountPercent: settings.pixDiscountPercent,
    paymentMethod: input.paymentMethod,
  });

  // Distribui descontos por loja (sem perder centavos).
  const groups = [...groupByStore(lines)];
  const storeIds = groups.map(([id]) => id);
  const shippingDiscounts = allocateProportionally(totals.shippingCents === shippingTotal ? 0 : shippingTotal - totals.shippingCents, storeIds.map((id) => shippingByStore[id]!.priceCents));
  const afterCouponByStore = groups.map(([, ls]) => ls.reduce((s, l) => s + l.lineTotalCents - (couponAllocations[l.key] ?? 0), 0));
  const pixDiscounts = allocateProportionally(totals.pixDiscountCents, afterCouponByStore);

  const stores: CheckoutQuote["stores"] = groups.map(([storeId, ls], i) => {
    const sub = ls.reduce((s, l) => s + l.lineTotalCents, 0);
    const couponPart = ls.reduce((s, l) => s + (couponAllocations[l.key] ?? 0), 0);
    const shipping = shippingByStore[storeId]!;
    const shipDisc = shippingDiscounts[i] ?? 0;
    const pixDisc = pixDiscounts[i] ?? 0;
    return {
      storeId,
      storeName: ls[0]!.store.name,
      isOfficial: ls[0]!.store.isOfficial,
      lines: ls,
      subtotalCents: sub,
      shipping,
      couponDiscountCents: couponPart,
      shippingDiscountCents: shipDisc,
      pixDiscountCents: pixDisc,
      totalCents: Math.max(0, sub - couponPart - pixDisc + shipping.priceCents - shipDisc),
    };
  });
  const storesTotal = stores.reduce((s, st) => s + st.totalCents, 0);
  if (storesTotal !== totals.totalCents) {
    logger.error("checkout.total_mismatch", { storesTotal, total: totals.totalCents });
    throw new AppError("INTERNAL", "Não foi possível calcular o total. Tente novamente.");
  }

  // Parcelamento: só cartão; juros (se houver) entram no valor cobrado pelo gateway.
  const options = installmentOptions(totals.totalCents, installmentConfigFrom(settings));
  const count = input.paymentMethod === "CREDIT_CARD" ? input.installments : 1;
  const installment = input.paymentMethod === "PIX" ? { count: 1, installmentCents: totals.totalCents, totalCents: totals.totalCents, interestFree: true } : options.find((o) => o.count === count);
  if (!installment) throw new AppError("VALIDATION", "Parcelamento indisponível para este valor.", { fieldErrors: { installments: ["Escolha outra opção de parcelamento"] } });

  return { address, settings, quote: { lines, stores, totals, coupon, couponAllocations, installments: installment } satisfies CheckoutQuote };
}

function addressSnapshot(a: { recipientName: string; phone: string | null; cep: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; reference: string | null }) {
  return { recipientName: a.recipientName, phone: a.phone, cep: a.cep, street: a.street, number: a.number, complement: a.complement, district: a.district, city: a.city, state: a.state, reference: a.reference };
}

export async function createCheckout(userId: string, input: CheckoutInput) {
  // 1) Idempotência: o mesmo envio (duplo clique, rede instável) retorna a mesma compra.
  const existing = await db.checkout.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, userId: true } });
  if (existing) {
    if (existing.userId !== userId) throw conflict("Sessão de checkout inválida. Recarregue a página.");
    return { checkoutId: existing.id, reused: true };
  }

  const gateway = getPaymentGateway();
  if (!gateway.supportsMethods.includes(input.paymentMethod)) throw new AppError("VALIDATION", "Forma de pagamento indisponível.");
  if (input.paymentMethod === "CREDIT_CARD" && !input.cardToken) throw new AppError("VALIDATION", "Dados do cartão incompletos.", { fieldErrors: { cardToken: ["Informe o cartão"] } });

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, cpf: true, phone: true, status: true } });
  if (!user || user.status !== "ACTIVE") throw new AppError("FORBIDDEN", "Conta indisponível para compras.");
  if (user.cpf && user.cpf !== input.customer.cpf) throw new AppError("VALIDATION", "O CPF deve ser o mesmo cadastrado na sua conta.", { fieldErrors: { "customer.cpf": ["CPF diferente do cadastrado"] } });
  if (!user.cpf) {
    const taken = await db.user.findFirst({ where: { cpf: input.customer.cpf, id: { not: userId } }, select: { id: true } });
    if (taken) throw new AppError("VALIDATION", "Este CPF está vinculado a outra conta.", { fieldErrors: { "customer.cpf": ["CPF já cadastrado em outra conta"] } });
  }

  const { address, settings, quote } = await buildCheckoutQuote(userId, input);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.orderReservationMinutes * 60_000);

  // Limite por cliente em promoções.
  const promoQty = new Map<string, { qty: number; limit: number | null; name: string }>();
  for (const l of quote.lines) {
    const p = l.price.promotion;
    if (!p) continue;
    const cur = promoQty.get(p.id) ?? { qty: 0, limit: p.perCustomerLimit, name: p.name };
    cur.qty += l.quantity;
    promoQty.set(p.id, cur);
  }
  for (const [promotionId, info] of promoQty) {
    if (info.limit === null) continue;
    const bought = await db.orderItem.aggregate({ where: { promotionId, order: { userId, status: { notIn: ["CANCELLED"] } } }, _sum: { quantity: true } });
    if ((bought._sum.quantity ?? 0) + info.qty > info.limit) {
      throw new AppError("UNPROCESSABLE", `A oferta "${info.name}" permite até ${info.limit} unidade(s) por cliente.`);
    }
  }

  let checkoutId: string;
  try {
    checkoutId = await db.$transaction(
      async (tx) => {
        // Cupom: limite global atômico + limite por usuário serializado por lock consultivo.
        if (quote.coupon) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${quote.coupon.id}`}))`;
          const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: quote.coupon.id }, select: { usageLimitPerUser: true } });
          if (coupon.usageLimitPerUser !== null) {
            const used = await tx.couponRedemption.count({ where: { couponId: quote.coupon.id, userId } });
            if (used >= coupon.usageLimitPerUser) throw new AppError("UNPROCESSABLE", "Você já utilizou este cupom o máximo de vezes permitido.");
          }
          const updated = await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${quote.coupon.id} AND "isActive" = true AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
          if (updated !== 1) throw new AppError("UNPROCESSABLE", "Este cupom acabou de esgotar. Remova-o para continuar.");
        }

        // Estoque promocional atômico.
        for (const [promotionId, info] of promoQty) {
          const updated = await tx.$executeRaw`UPDATE "Promotion" SET "soldCount" = "soldCount" + ${info.qty} WHERE "id" = ${promotionId} AND ("stockLimit" IS NULL OR "soldCount" + ${info.qty} <= "stockLimit")`;
          if (updated !== 1) throw new AppError("OUT_OF_STOCK", `A oferta "${info.name}" esgotou. Atualize o carrinho para ver o preço atual.`);
        }

        const checkout = await tx.checkout.create({
          data: {
            userId,
            idempotencyKey: input.idempotencyKey,
            subtotalCents: quote.totals.subtotalCents,
            discountCents: quote.totals.couponDiscountCents + quote.totals.pixDiscountCents,
            shippingCents: quote.totals.shippingCents,
            totalCents: quote.totals.totalCents,
            couponId: quote.coupon?.id ?? null,
            couponCode: quote.coupon?.code ?? null,
            paymentMethod: input.paymentMethod,
            installments: quote.installments.count,
            shippingAddress: addressSnapshot(address),
            customerSnapshot: { name: user.name, email: user.email, cpf: input.customer.cpf, phone: input.customer.phone },
            expiresAt,
          },
          select: { id: true },
        });

        for (const store of quote.stores) {
          const pixParts = allocateProportionally(store.pixDiscountCents, store.lines.map((l) => l.lineTotalCents - (quote.couponAllocations[l.key] ?? 0)));
          const order = await tx.order.create({
            data: {
              number: generateOrderNumber(),
              checkoutId: checkout.id,
              userId,
              storeId: store.storeId,
              subtotalCents: store.subtotalCents,
              discountCents: store.couponDiscountCents + store.pixDiscountCents,
              shippingCents: store.shipping.priceCents - store.shippingDiscountCents,
              totalCents: store.totalCents,
              shippingAddress: addressSnapshot(address),
              shippingService: store.shipping.service,
              shippingEtaDays: store.shipping.maxDays,
              customerNote: input.customerNote ?? null,
            },
            select: { id: true },
          });
          for (const [i, l] of store.lines.entries()) {
            const discount = (quote.couponAllocations[l.key] ?? 0) + (pixParts[i] ?? 0);
            await tx.orderItem.create({
              data: {
                orderId: order.id,
                productId: l.productId,
                variantId: l.variantId,
                productName: l.productName,
                variantName: l.variantName,
                sku: l.sku,
                imageUrl: l.imageUrl,
                unitPriceCents: l.unitPriceCents,
                originalPriceCents: l.price.basePriceCents,
                quantity: l.quantity,
                discountCents: discount,
                totalCents: l.lineTotalCents - discount,
                promotionId: l.price.promotion?.id ?? null,
              },
            });
            // Reserva atômica: falha se outro comprador levou o estoque.
            const { count } = await tx.productVariant.updateMany({
              where: { id: l.variantId, status: "ACTIVE", stock: { gte: l.quantity } },
              data: { stock: { decrement: l.quantity } },
            });
            if (count !== 1) throw new AppError("OUT_OF_STOCK", `${l.productName} (${l.variantName}) acabou de esgotar ou não tem a quantidade desejada. Atualize o carrinho.`);
            const v = await tx.productVariant.findUniqueOrThrow({ where: { id: l.variantId }, select: { stock: true } });
            await tx.inventoryMovement.create({ data: { variantId: l.variantId, type: "SALE", quantity: -l.quantity, balanceAfter: v.stock, reason: "Reserva de pedido", orderId: order.id, actorId: userId } });
          }
          await tx.orderEvent.create({ data: { orderId: order.id, status: "PENDING_PAYMENT", note: "Pedido criado — aguardando pagamento" } });
          await tx.shipment.create({
            data: {
              orderId: order.id,
              provider: store.shipping.optionId.split(":")[0] ?? "table",
              service: store.shipping.service,
              carrier: store.shipping.carrier,
              priceCents: store.shipping.priceCents - store.shippingDiscountCents,
              estimatedDays: store.shipping.maxDays,
              estimatedDeliveryAt: new Date(now.getTime() + store.shipping.maxDays * 24 * 3600_000),
            },
          });
        }

        if (quote.coupon) {
          await tx.couponRedemption.create({ data: { couponId: quote.coupon.id, userId, checkoutId: checkout.id, discountCents: quote.totals.couponDiscountCents } });
        }
        await tx.user.update({ where: { id: userId }, data: { ...(user.cpf ? {} : { cpf: input.customer.cpf }), ...(user.phone ? {} : { phone: input.customer.phone }) } });
        return checkout.id;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    // Envio duplicado concorrente (duplo clique): o perdedor da corrida falha na
    // chave única ou na reserva. Se a compra com esta chave já existe para o
    // mesmo usuário, devolve-a — mesma chave, mesmo resultado. (Não depende do
    // formato de meta.target, que varia com o driver adapter do Prisma.)
    const again = await db.checkout.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, userId: true } });
    if (again && again.userId === userId) return { checkoutId: again.id, reused: true };
    throw error;
  }

  await removePurchasedItems(userId, quote.lines.map((l) => l.variantId));
  await recomputeProductAggregates(quote.lines.map((l) => l.productId));
  await startPayment(checkoutId, { cardToken: input.cardToken, cardPaymentMethodId: input.cardPaymentMethodId, cardIssuerId: input.cardIssuerId });
  return { checkoutId, reused: false };
}

/** Cria uma tentativa de pagamento no gateway para o checkout (idempotente por tentativa). */
export async function startPayment(
  checkoutId: string,
  card: { cardToken?: string; cardPaymentMethodId?: string; cardIssuerId?: string },
  methodOverride?: { method: "PIX" | "CREDIT_CARD"; installments: number },
) {
  const checkout = await db.checkout.findUniqueOrThrow({
    where: { id: checkoutId },
    select: { id: true, idempotencyKey: true, status: true, totalCents: true, paymentMethod: true, installments: true, expiresAt: true, customerSnapshot: true, _count: { select: { payments: true } }, orders: { select: { number: true } } },
  });
  if (checkout.status !== "PENDING_PAYMENT") throw new AppError("UNPROCESSABLE", "Esta compra não está mais aguardando pagamento.");
  if (checkout.expiresAt.getTime() <= Date.now()) {
    await releaseCheckout(checkoutId, { reason: "Reserva expirada", finalStatus: "EXPIRED" });
    throw new AppError("UNPROCESSABLE", "O prazo para pagamento expirou e os itens foram liberados. Faça um novo pedido.");
  }
  const method = methodOverride?.method ?? checkout.paymentMethod;
  const installments = methodOverride?.installments ?? checkout.installments;
  const settings = await getStoreSettings();
  let amount = checkout.totalCents;
  if (method === "CREDIT_CARD") {
    const opt = installmentOptions(checkout.totalCents, installmentConfigFrom(settings)).find((o) => o.count === installments);
    if (!opt) throw new AppError("VALIDATION", "Parcelamento indisponível.");
    // No Mercado Pago os juros do parcelamento são calculados e cobrados pelo
    // próprio MP (conforme a configuração da conta). Enviar o valor base evita
    // juros em dobro; nos demais gateways o app aplica a Tabela Price.
    amount = getPaymentGateway().name === MERCADOPAGO_PROVIDER ? checkout.totalCents : opt.totalCents;
  }
  const attempt = checkout._count.payments + 1;
  const customer = checkout.customerSnapshot as { name: string; email: string; cpf: string; phone?: string };
  const payment = await db.payment.create({
    data: {
      checkoutId,
      provider: getPaymentGateway().name,
      idempotencyKey: createHash("sha256").update(`${checkout.idempotencyKey}:${attempt}`).digest("hex"),
      method,
      amountCents: amount,
      installments: method === "PIX" ? 1 : installments,
      isSandbox: getPaymentGateway().isSandbox,
    },
    select: { id: true, idempotencyKey: true },
  });

  try {
    const result = await getPaymentGateway().createPayment({
      idempotencyKey: payment.idempotencyKey,
      paymentId: payment.id,
      amountCents: amount,
      method,
      installments: method === "PIX" ? 1 : installments,
      description: `Mercatto — pedido ${checkout.orders.map((o) => o.number).join(", ")}`.slice(0, 200),
      payer: { name: customer.name, email: customer.email, cpf: customer.cpf, phone: customer.phone ?? null },
      cardToken: card.cardToken ?? null,
      paymentMethodId: card.cardPaymentMethodId ?? null,
      issuerId: card.cardIssuerId ?? null,
      expiresAt: checkout.expiresAt,
      notificationUrl: `${env.APP_URL}/api/webhooks/payments/${getPaymentGateway().name}`,
    });
    await db.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: result.providerPaymentId,
        pixQrCode: result.pix?.qrCode ?? null,
        pixQrCodeImage: result.pix?.qrCodeImageDataUrl ?? null,
        pixExpiresAt: result.pix?.expiresAt ?? null,
        cardBrand: result.card?.brand ?? null,
        cardLast4: result.card?.last4 ?? null,
        failureReason: result.failureReason ?? null,
        isSandbox: result.isSandbox,
      },
    });
    if (method !== checkout.paymentMethod || installments !== checkout.installments) {
      await db.checkout.update({ where: { id: checkoutId }, data: { paymentMethod: method, installments } });
    }
    if (result.status !== "PENDING") {
      await applyPaymentStatus({ provider: getPaymentGateway().name, providerPaymentId: result.providerPaymentId, status: result.status, eventId: `sync:${payment.id}` });
    }
    return { paymentId: payment.id, status: result.status };
  } catch (error) {
    const reason = isProviderError(error) || error instanceof AppError ? error.message : "Falha de comunicação com o meio de pagamento.";
    logger.error("checkout.payment_start_failed", { checkoutId, paymentId: payment.id, error });
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: reason } });
    return { paymentId: payment.id, status: "FAILED" as const, error: reason };
  }
}

/** Nova tentativa de pagamento (ex.: cartão recusado → PIX) enquanto a reserva vale. */
export async function retryPayment(userId: string, checkoutId: string, input: { method: "PIX" | "CREDIT_CARD"; installments: number; cardToken?: string; cardPaymentMethodId?: string; cardIssuerId?: string }) {
  const checkout = await db.checkout.findFirst({ where: { id: checkoutId, userId }, select: { id: true, payments: { where: { status: { in: ["PENDING", "AUTHORIZED"] } }, select: { id: true, method: true } } } });
  if (!checkout) throw notFound("Compra não encontrada.");
  if (input.method === "CREDIT_CARD" && !input.cardToken) throw new AppError("VALIDATION", "Dados do cartão incompletos.");
  const pendingSame = checkout.payments.find((p) => p.method === input.method && input.method === "PIX");
  if (pendingSame) return { paymentId: pendingSame.id, status: "PENDING" as const };
  return startPayment(checkoutId, input, { method: input.method, installments: input.method === "PIX" ? 1 : input.installments });
}

/** Cancelamento pelo cliente de uma compra ainda não paga. */
export async function cancelPendingCheckout(userId: string, checkoutId: string) {
  const checkout = await db.checkout.findFirst({ where: { id: checkoutId, userId }, select: { id: true, status: true, payments: { where: { status: { in: ["PENDING", "AUTHORIZED"] } }, select: { providerPaymentId: true } } } });
  if (!checkout) throw notFound("Compra não encontrada.");
  if (checkout.status !== "PENDING_PAYMENT") throw new AppError("UNPROCESSABLE", "Esta compra não pode mais ser cancelada por aqui.");
  for (const p of checkout.payments) {
    if (p.providerPaymentId) await getPaymentGateway().cancelPayment(p.providerPaymentId).catch((error) => logger.warn("checkout.cancel_gateway_failed", { error }));
  }
  await releaseCheckout(checkoutId, { reason: "Cancelado pelo cliente", finalStatus: "CANCELLED", actorId: userId });
}

/** Expira reservas vencidas (cron e verificação sob demanda). Idempotente e em lotes. */
export async function expireStaleCheckouts(limit = 100) {
  const stale = await db.checkout.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
    select: { id: true, payments: { where: { status: { in: ["PENDING", "AUTHORIZED"] } }, select: { provider: true, providerPaymentId: true } } },
    take: limit,
    orderBy: { expiresAt: "asc" },
  });
  let expired = 0;
  for (const c of stale) {
    // Antes de expirar, confirma no gateway: um pagamento aprovado (webhook
    // perdido) nunca deve virar pedido cancelado.
    let paid = false;
    for (const p of c.payments) if ((await reconcilePayment(p, { force: true })) === "PAID") paid = true;
    if (paid) continue;
    for (const p of c.payments) {
      if (p.providerPaymentId) await getPaymentGateway().cancelPayment(p.providerPaymentId).catch(() => undefined);
    }
    const result = await releaseCheckout(c.id, { reason: "Pagamento não realizado no prazo", finalStatus: "EXPIRED" });
    if (result.released) expired++;
  }
  return { checked: stale.length, expired };
}
