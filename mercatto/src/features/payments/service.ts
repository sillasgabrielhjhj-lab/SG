import "server-only";
import type { PaymentStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { audit } from "@/server/observability/audit";
import { getPaymentGateway } from "@/server/providers/payments";
import { DEV_PAYMENT_PROVIDER } from "@/server/providers/payments/dev";
import { rateLimit } from "@/server/security/rate-limit";
import type { GatewayPaymentStatus } from "@/server/providers/payments/types";
import { notify } from "@/features/notifications/service";
import {
  newOrderSellerEmail,
  orderCancelledEmail,
  orderPaidEmail,
  paymentFailedEmail,
} from "@/features/notifications/templates";
import { recomputeProductAggregates } from "@/features/catalog/aggregates";

/**
 * PAGAMENTOS — fonte única de transições de pagamento/checkout/pedidos.
 * Idempotência: cada chamada trava a linha do pagamento (SELECT ... FOR UPDATE)
 * e só executa transições válidas a partir do estado ATUAL — eventos
 * duplicados, atrasados ou fora de ordem não causam efeitos repetidos.
 */

const FINAL_PAYMENT: PaymentStatus[] = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"];

async function lockPayment(tx: Tx, paymentId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
}

async function lockCheckout(tx: Tx, checkoutId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Checkout" WHERE "id" = ${checkoutId} FOR UPDATE`;
}

/**
 * Libera a reserva de um checkout ainda não pago: devolve estoque, reverte
 * estoque promocional e uso de cupom, cancela pedidos. Idempotente (só age
 * sobre pedidos ainda em PENDING_PAYMENT, com o checkout travado).
 */
export async function releaseCheckout(
  checkoutId: string,
  opts: { reason: string; finalStatus: "EXPIRED" | "CANCELLED"; actorId?: string | null },
  outerTx?: Tx,
) {
  const run = async (tx: Tx) => {
    await lockCheckout(tx, checkoutId);
    const checkout = await tx.checkout.findUnique({
      where: { id: checkoutId },
      select: {
        id: true,
        status: true,
        couponId: true,
        userId: true,
        orders: { where: { status: "PENDING_PAYMENT" }, select: { id: true, number: true, totalCents: true, items: { select: { variantId: true, productId: true, quantity: true, promotionId: true } } } },
      },
    });
    if (!checkout || checkout.status !== "PENDING_PAYMENT") return { released: false, productIds: [] as string[], orders: [] as { number: string; totalCents: number }[] };

    const productIds = new Set<string>();
    const promoQty = new Map<string, number>();
    for (const order of checkout.orders) {
      for (const item of order.items) {
        const v = await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } }, select: { stock: true } });
        await tx.inventoryMovement.create({
          data: { variantId: item.variantId, type: "CANCELLATION", quantity: item.quantity, balanceAfter: v.stock, reason: opts.reason, orderId: order.id, actorId: opts.actorId ?? null },
        });
        productIds.add(item.productId);
        if (item.promotionId) promoQty.set(item.promotionId, (promoQty.get(item.promotionId) ?? 0) + item.quantity);
      }
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: opts.reason } });
      await tx.orderEvent.create({ data: { orderId: order.id, status: "CANCELLED", note: opts.reason, actorId: opts.actorId ?? null } });
      await tx.shipment.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });
    }
    for (const [promotionId, qty] of promoQty) {
      await tx.$executeRaw`UPDATE "Promotion" SET "soldCount" = GREATEST(0, "soldCount" - ${qty}) WHERE "id" = ${promotionId}`;
    }
    if (checkout.couponId) {
      const removed = await tx.couponRedemption.deleteMany({ where: { checkoutId } });
      if (removed.count > 0) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST(0, "usedCount" - 1) WHERE "id" = ${checkout.couponId}`;
    }
    await tx.checkout.update({ where: { id: checkoutId }, data: { status: opts.finalStatus } });
    await tx.payment.updateMany({ where: { checkoutId, status: { in: ["PENDING", "AUTHORIZED"] } }, data: { status: opts.finalStatus === "EXPIRED" ? "EXPIRED" : "CANCELLED" } });
    return { released: true, productIds: [...productIds], orders: checkout.orders.map((o) => ({ number: o.number, totalCents: o.totalCents })), userId: checkout.userId };
  };
  const result = outerTx ? await run(outerTx) : await db.$transaction(run);
  if (!outerTx && result.released) await recomputeProductAggregates(result.productIds);
  return result;
}

/** Tenta reservar novamente o estoque de um checkout expirado (pagamento chegou atrasado). */
async function tryReReserve(tx: Tx, checkoutId: string) {
  const orders = await tx.order.findMany({
    where: { checkoutId, status: "CANCELLED" },
    select: { id: true, items: { select: { variantId: true, quantity: true } } },
  });
  for (const order of orders) {
    for (const item of order.items) {
      const { count } = await tx.productVariant.updateMany({ where: { id: item.variantId, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
      if (count !== 1) return false;
      const v = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId }, select: { stock: true } });
      await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: "SALE", quantity: -item.quantity, balanceAfter: v.stock, reason: "Reserva refeita (pagamento confirmado após expiração)", orderId: order.id } });
    }
  }
  return true;
}

export type ApplyPaymentInput = {
  provider: string;
  providerPaymentId: string;
  status: GatewayPaymentStatus;
  eventId?: string;
  paidAmountCents?: number;
};

export async function applyPaymentStatus(input: ApplyPaymentInput) {
  const payment = await db.payment.findUnique({
    where: { providerPaymentId: input.providerPaymentId },
    select: { id: true, provider: true },
  });
  if (!payment || payment.provider !== input.provider) {
    logger.warn("payments.unknown_payment", { provider: input.provider, providerPaymentId: input.providerPaymentId });
    return { outcome: "ignored" as const };
  }

  const effects: { paidCheckoutId?: string; refundLateFor?: string; failedCheckoutId?: string; releasedProductIds?: string[] } = {};

  await db.$transaction(async (tx) => {
    await lockPayment(tx, payment.id);
    const current = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: { id: true, status: true, amountCents: true, checkoutId: true, checkout: { select: { id: true, status: true, expiresAt: true } } },
    });

    if (input.status === "PAID") {
      if (FINAL_PAYMENT.includes(current.status)) return; // evento duplicado/atrasado
      if (input.paidAmountCents !== undefined && input.paidAmountCents !== current.amountCents) {
        logger.error("payments.amount_mismatch", { paymentId: current.id, expected: current.amountCents, received: input.paidAmountCents });
        await audit({ action: "payment.status_changed", entityType: "Payment", entityId: current.id, after: { blocked: "amount_mismatch", expected: current.amountCents, received: input.paidAmountCents } }, tx);
        return;
      }
      await lockCheckout(tx, current.checkoutId);
      const checkout = await tx.checkout.findUniqueOrThrow({ where: { id: current.checkoutId }, select: { status: true } });
      if (checkout.status === "PAID") {
        // Outro pagamento do mesmo checkout já foi aprovado: este é duplicado e deve ser estornado.
        await tx.payment.update({ where: { id: current.id }, data: { status: "PAID", paidAt: new Date() } });
        effects.refundLateFor = current.id;
        return;
      }
      if (checkout.status !== "PENDING_PAYMENT") {
        // Pagamento após expiração/cancelamento: tenta refazer a reserva; senão, estorna.
        const ok = await tryReReserve(tx, current.checkoutId);
        if (!ok) {
          await tx.payment.update({ where: { id: current.id }, data: { status: "PAID", paidAt: new Date() } });
          effects.refundLateFor = current.id;
          return;
        }
        await tx.order.updateMany({ where: { checkoutId: current.checkoutId, status: "CANCELLED" }, data: { status: "PENDING_PAYMENT", cancelledAt: null, cancelReason: null } });
      }

      const now = new Date();
      await tx.payment.update({ where: { id: current.id }, data: { status: "PAID", paidAt: now, failureReason: null } });
      await tx.checkout.update({ where: { id: current.checkoutId }, data: { status: "PAID" } });
      // Demais tentativas pendentes do checkout deixam de valer.
      await tx.payment.updateMany({ where: { checkoutId: current.checkoutId, id: { not: current.id }, status: { in: ["PENDING", "AUTHORIZED"] } }, data: { status: "CANCELLED" } });
      const orders = await tx.order.findMany({
        where: { checkoutId: current.checkoutId, status: "PENDING_PAYMENT" },
        select: { id: true, storeId: true, items: { select: { productId: true, quantity: true } } },
      });
      const today = new Date(now.toISOString().slice(0, 10));
      for (const order of orders) {
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: now } });
        await tx.orderEvent.create({ data: { orderId: order.id, status: "PAID", note: "Pagamento aprovado" } });
        await tx.shipment.updateMany({ where: { orderId: order.id }, data: { status: "PENDING" } });
        await tx.store.update({ where: { id: order.storeId }, data: { salesCount: { increment: 1 } } });
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { salesCount: { increment: item.quantity } } });
          await tx.productDailyStat.upsert({
            where: { productId_day: { productId: item.productId, day: today } },
            update: { purchases: { increment: item.quantity } },
            create: { productId: item.productId, day: today, purchases: item.quantity },
          });
        }
      }
      await audit({ action: "payment.status_changed", entityType: "Payment", entityId: current.id, before: { status: current.status }, after: { status: "PAID", eventId: input.eventId ?? null } }, tx);
      effects.paidCheckoutId = current.checkoutId;
      return;
    }

    if (input.status === "REFUNDED" || input.status === "PARTIALLY_REFUNDED") {
      if (current.status === input.status) return;
      await tx.payment.update({ where: { id: current.id }, data: { status: input.status } });
      await audit({ action: "payment.status_changed", entityType: "Payment", entityId: current.id, before: { status: current.status }, after: { status: input.status, source: "gateway" } }, tx);
      return;
    }

    if (input.status === "AUTHORIZED" || input.status === "PENDING") {
      if (current.status === "PENDING" && input.status === "AUTHORIZED") {
        await tx.payment.update({ where: { id: current.id }, data: { status: "AUTHORIZED" } });
      }
      return;
    }

    // FAILED | CANCELLED | EXPIRED — nunca regride um pagamento já aprovado.
    if (FINAL_PAYMENT.includes(current.status) || ["FAILED", "CANCELLED", "EXPIRED"].includes(current.status)) return;
    await tx.payment.update({ where: { id: current.id }, data: { status: input.status } });
    await audit({ action: "payment.status_changed", entityType: "Payment", entityId: current.id, before: { status: current.status }, after: { status: input.status, eventId: input.eventId ?? null } }, tx);

    // Recusa de cartão mantém a reserva até expirar (cliente pode tentar outro meio).
    // PIX expirado/cancelado ou reserva vencida libera o estoque.
    const reservationOver = current.checkout.expiresAt.getTime() <= Date.now();
    if (input.status !== "FAILED" || reservationOver) {
      const others = await tx.payment.count({ where: { checkoutId: current.checkoutId, id: { not: current.id }, status: { in: ["PENDING", "AUTHORIZED"] } } });
      if (others === 0 && current.checkout.status === "PENDING_PAYMENT") {
        const released = await releaseCheckout(current.checkoutId, { reason: input.status === "EXPIRED" ? "Pagamento não realizado no prazo" : "Pagamento cancelado", finalStatus: input.status === "EXPIRED" ? "EXPIRED" : "CANCELLED" }, tx);
        effects.releasedProductIds = released.productIds;
      }
    }
    effects.failedCheckoutId = current.checkoutId;
  });

  // ---- Efeitos fora da transação (notificações, estornos, agregados) ----
  if (effects.paidCheckoutId) await afterPaid(effects.paidCheckoutId);
  if (effects.refundLateFor) await refundLatePayment(effects.refundLateFor);
  if (effects.releasedProductIds?.length) await recomputeProductAggregates(effects.releasedProductIds);
  if (effects.failedCheckoutId) await afterFailed(effects.failedCheckoutId, input.status);
  return { outcome: "processed" as const };
}

async function afterPaid(checkoutId: string) {
  const orders = await db.order.findMany({
    where: { checkoutId },
    select: { id: true, number: true, totalCents: true, userId: true, store: { select: { ownerId: true } }, _count: { select: { items: true } }, items: { select: { productId: true } } },
  });
  for (const order of orders) {
    await notify({ userId: order.userId, type: "ORDER_PAID", title: "Pagamento aprovado", body: `Pedido ${order.number} confirmado. Estamos preparando tudo!`, link: `/minha-conta/pedidos/${order.number}`, email: orderPaidEmail(order) });
    await notify({ userId: order.store.ownerId, type: "NEW_ORDER", title: "Nova venda!", body: `Pedido ${order.number} pago — prepare o envio.`, link: `/vendedor/pedidos/${order.id}`, email: newOrderSellerEmail({ ...order, itemsCount: order._count.items }) });
  }
  await recomputeProductAggregates(orders.flatMap((o) => o.items.map((i) => i.productId)));
}

async function afterFailed(checkoutId: string, status: GatewayPaymentStatus) {
  const orders = await db.order.findMany({ where: { checkoutId }, select: { number: true, totalCents: true, userId: true, status: true } });
  const first = orders[0];
  if (!first) return;
  if (status === "FAILED") {
    await notify({ userId: first.userId, type: "PAYMENT_FAILED", title: "Pagamento não aprovado", body: "Tente novamente com outra forma de pagamento.", link: `/checkout/pagamento/${checkoutId}`, email: paymentFailedEmail(first) });
  } else {
    for (const order of orders.filter((o) => o.status === "CANCELLED")) {
      await notify({ userId: order.userId, type: "ORDER_CANCELLED", title: "Pedido cancelado", body: `O pedido ${order.number} foi cancelado: o pagamento não foi concluído.`, link: `/minha-conta/pedidos/${order.number}`, email: orderCancelledEmail(order, "pagamento não concluído") });
    }
  }
}

/** Estorna automaticamente um pagamento que não pode ser honrado (duplicado ou tardio sem estoque). */
async function refundLatePayment(paymentId: string) {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { id: true, providerPaymentId: true, amountCents: true, refundedCents: true, checkoutId: true } });
  const amount = payment.amountCents - payment.refundedCents;
  if (!payment.providerPaymentId || amount <= 0) return;
  try {
    const result = await getPaymentGateway().refund(payment.providerPaymentId, amount, `refund:late:${payment.id}`);
    await db.$transaction([
      db.refund.create({ data: { paymentId: payment.id, amountCents: amount, status: result.status, reason: "Estorno automático: pagamento recebido sem reserva válida", providerRefundId: result.providerRefundId } }),
      db.payment.update({ where: { id: payment.id }, data: { refundedCents: { increment: amount }, status: "REFUNDED" } }),
    ]);
    logger.warn("payments.late_payment_refunded", { paymentId: payment.id, amountCents: amount });
  } catch (error) {
    logger.error("payments.late_refund_failed", { paymentId: payment.id, error });
    await audit({ action: "refund.requested", entityType: "Payment", entityId: payment.id, after: { reason: "late_payment_refund_failed", amountCents: amount } });
  }
}

/**
 * Reembolso (total ou parcial) de um pedido pago. Idempotente por pedido:
 * a chave enviada ao gateway é derivada do pedido + valor acumulado.
 */
export async function refundOrder(orderId: string, actorId: string | null, opts: { amountCents?: number; reason: string; restock: boolean }) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      userId: true,
      checkoutId: true,
      items: { select: { variantId: true, productId: true, quantity: true } },
      refunds: { where: { status: { in: ["PENDING", "SUCCEEDED"] } }, select: { amountCents: true } },
    },
  });
  if (!order) throw notFound("Pedido não encontrado.");
  const payment = await db.payment.findFirst({ where: { checkoutId: order.checkoutId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, orderBy: { paidAt: "desc" } });
  if (!payment || !payment.providerPaymentId) throw new AppError("UNPROCESSABLE", "Não há pagamento aprovado para reembolsar.");
  const alreadyRefunded = order.refunds.reduce((s, r) => s + r.amountCents, 0);
  const maxForOrder = order.totalCents - alreadyRefunded;
  const amount = Math.min(opts.amountCents ?? maxForOrder, maxForOrder, payment.amountCents - payment.refundedCents);
  if (amount <= 0) throw new AppError("UNPROCESSABLE", "Este pedido já foi totalmente reembolsado.");

  const result = await getPaymentGateway().refund(payment.providerPaymentId, amount, `refund:${order.id}:${alreadyRefunded + amount}`);
  const productIds = new Set<string>();
  await db.$transaction(async (tx) => {
    await lockPayment(tx, payment.id);
    await tx.refund.create({ data: { paymentId: payment.id, orderId: order.id, amountCents: amount, status: result.status, reason: opts.reason, providerRefundId: result.providerRefundId, requestedById: actorId } });
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { refundedCents: { increment: amount } }, select: { refundedCents: true, amountCents: true } });
    await tx.payment.update({ where: { id: payment.id }, data: { status: updated.refundedCents >= updated.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    const fullyRefunded = alreadyRefunded + amount >= order.totalCents;
    if (fullyRefunded) {
      await tx.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
      await tx.orderEvent.create({ data: { orderId: order.id, status: "REFUNDED", note: opts.reason, actorId } });
      if (opts.restock) {
        for (const item of order.items) {
          const v = await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } }, select: { stock: true } });
          await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: "RETURN", quantity: item.quantity, balanceAfter: v.stock, reason: `Reembolso do pedido ${order.number}`, orderId: order.id, actorId } });
          productIds.add(item.productId);
        }
      }
    }
    await audit({ actorId, action: "refund.completed", entityType: "Order", entityId: order.id, after: { amountCents: amount, status: result.status, restock: opts.restock } }, tx);
  });
  if (productIds.size) await recomputeProductAggregates([...productIds]);
  return { amountCents: amount, status: result.status };
}

/**
 * Conciliação com o gateway (fallback de webhook perdido ou atrasado): consulta
 * o status na API do provedor — fonte da verdade — e aplica pelo mesmo caminho
 * idempotente do webhook. Limitado a 1 consulta a cada 15 s por pagamento.
 * Nunca lança: falhas apenas são registradas (o webhook continua valendo).
 */
export async function reconcilePayment(payment: { provider: string; providerPaymentId: string | null }, opts: { force?: boolean } = {}) {
  const gateway = getPaymentGateway();
  if (!payment.providerPaymentId || payment.provider !== gateway.name || gateway.name === DEV_PAYMENT_PROVIDER) return null;
  try {
    if (!opts.force && !(await rateLimit(`reconcile:${payment.providerPaymentId}`, 1, 15)).allowed) return null;
    const status = await gateway.getPaymentStatus(payment.providerPaymentId);
    if (status !== "PENDING") await applyPaymentStatus({ provider: gateway.name, providerPaymentId: payment.providerPaymentId, status });
    return status;
  } catch (error) {
    logger.warn("payments.reconcile_failed", { providerPaymentId: payment.providerPaymentId, error });
    return null;
  }
}
