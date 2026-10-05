import "server-only";
import type { OrderStatus, ShipmentStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { AppError, forbidden, notFound } from "@/server/errors";
import { audit } from "@/server/observability/audit";
import { notify } from "@/features/notifications/service";
import { orderCancelledEmail, orderDeliveredEmail, orderShippedEmail } from "@/features/notifications/templates";
import { recomputeProductAggregates } from "@/features/catalog/aggregates";
import { refundOrder, releaseCheckout } from "@/features/payments/service";
import {
  canTransition,
  isRefundRejection,
  ORDER_STATUS_LABELS,
  RETURN_WINDOW_DAYS,
  statusBeforeRefundRequest,
  type OrderActorRole,
} from "@/features/orders/state-machine";

export type OrderActor = { userId: string; role: OrderActorRole; storeId?: string | null };

const SHIPMENT_STATUS: Partial<Record<OrderStatus, ShipmentStatus>> = {
  PROCESSING: "READY_TO_SHIP",
  SHIPPED: "SHIPPED",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

async function loadOrderForActor(orderId: string, actor: OrderActor) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      userId: true,
      storeId: true,
      checkoutId: true,
      totalCents: true,
      deliveredAt: true,
      items: { select: { variantId: true, productId: true, quantity: true } },
      events: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
      shipment: { select: { id: true, events: true, trackingCode: true, carrier: true, trackingUrl: true } },
    },
  });
  if (!order) throw notFound("Pedido não encontrado.");
  // Escopo de dados (anti-IDOR): cliente só o próprio pedido; vendedor só pedidos da sua loja.
  if (actor.role === "CUSTOMER" && order.userId !== actor.userId) throw notFound("Pedido não encontrado.");
  if (actor.role === "SELLER" && order.storeId !== actor.storeId) throw notFound("Pedido não encontrado.");
  return order;
}

/**
 * Transição de status do pedido com validação da máquina de estados, do
 * papel do ator e da propriedade. Atualiza envio, histórico, notificações e auditoria.
 */
export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus,
  actor: OrderActor,
  data: { trackingCode?: string; carrier?: string; trackingUrl?: string; note?: string } = {},
) {
  const order = await loadOrderForActor(orderId, actor);
  if (!canTransition(order.status, to, actor.role)) {
    throw new AppError("UNPROCESSABLE", `Não é possível mudar de "${ORDER_STATUS_LABELS[order.status]}" para "${ORDER_STATUS_LABELS[to]}".`);
  }
  if (isRefundRejection(order.status, to)) {
    const previous = statusBeforeRefundRequest(order.events);
    if (previous !== to) throw new AppError("UNPROCESSABLE", "A recusa deve retornar o pedido ao status anterior à solicitação.");
  }
  if (to === "SHIPPED" && !data.trackingCode?.trim()) {
    throw new AppError("VALIDATION", "Informe o código de rastreio para marcar como enviado.", { fieldErrors: { trackingCode: ["Obrigatório"] } });
  }
  if (to === "REFUND_REQUESTED" && actor.role === "CUSTOMER" && order.status === "DELIVERED") {
    const deliveredAt = order.deliveredAt ?? order.events.find((e) => e.status === "DELIVERED")?.createdAt;
    if (deliveredAt && Date.now() - new Date(deliveredAt).getTime() > RETURN_WINDOW_DAYS * 24 * 3600_000) {
      throw new AppError("UNPROCESSABLE", `O prazo de ${RETURN_WINDOW_DAYS} dias para devolução terminou. Fale com o suporte.`);
    }
  }
  if (to === "CANCELLED" && order.status === "PENDING_PAYMENT") {
    // Cancelar compra pendente = liberar a reserva do checkout inteiro.
    await releaseCheckout(order.checkoutId, { reason: data.note ?? "Cancelado", finalStatus: "CANCELLED", actorId: actor.userId });
    return;
  }
  if (to === "REFUNDED") {
    await refundOrder(order.id, actor.userId, { reason: data.note ?? "Reembolso aprovado", restock: order.status !== "REFUND_REQUESTED" || statusBeforeRefundRequest(order.events) !== "DELIVERED" });
    await notifyStatus(order.id, "REFUNDED");
    return;
  }
  if (to === "CANCELLED" && ["PAID", "PROCESSING"].includes(order.status)) {
    await cancelPaidOrder(order.id, actor, data.note ?? "Cancelado pelo vendedor");
    return;
  }

  const now = new Date();
  const shipmentStatus = SHIPMENT_STATUS[to];
  const events = Array.isArray(order.shipment?.events) ? (order.shipment!.events as Prisma.JsonArray) : [];
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: to,
        ...(to === "SHIPPED" ? { shippedAt: now } : {}),
        ...(to === "DELIVERED" ? { deliveredAt: now } : {}),
      },
    });
    await tx.orderEvent.create({ data: { orderId: order.id, status: to, note: data.note ?? null, actorId: actor.userId } });
    if (order.shipment && shipmentStatus) {
      await tx.shipment.update({
        where: { id: order.shipment.id },
        data: {
          status: shipmentStatus,
          ...(data.trackingCode ? { trackingCode: data.trackingCode.trim().toUpperCase() } : {}),
          ...(data.carrier ? { carrier: data.carrier.trim() } : {}),
          ...(data.trackingUrl ? { trackingUrl: data.trackingUrl } : {}),
          ...(to === "SHIPPED" ? { shippedAt: now } : {}),
          ...(to === "DELIVERED" ? { deliveredAt: now } : {}),
          events: [...events, { status: shipmentStatus, description: ORDER_STATUS_LABELS[to], at: now.toISOString() }],
        },
      });
    }
    await audit({ actorId: actor.userId, action: "order.status_changed", entityType: "Order", entityId: order.id, before: { status: order.status }, after: { status: to, trackingCode: data.trackingCode ?? null } }, tx);
  });
  await notifyStatus(order.id, to, data);
}

/** Cancela pedido pago antes do envio: devolve estoque e reembolsa o valor do pedido. */
async function cancelPaidOrder(orderId: string, actor: OrderActor, reason: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, status: true, items: { select: { variantId: true, productId: true, quantity: true } } } });
  await db.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({ where: { id: order.id, status: { in: ["PAID", "PROCESSING"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
    if (count !== 1) throw new AppError("CONFLICT", "O pedido mudou de status. Atualize a página.");
    for (const item of order.items) {
      const v = await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } }, select: { stock: true } });
      await tx.inventoryMovement.create({ data: { variantId: item.variantId, type: "CANCELLATION", quantity: item.quantity, balanceAfter: v.stock, reason, orderId: order.id, actorId: actor.userId } });
    }
    await tx.orderEvent.create({ data: { orderId: order.id, status: "CANCELLED", note: reason, actorId: actor.userId } });
    await tx.shipment.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });
    await tx.store.update({ where: { id: (await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { storeId: true } })).storeId }, data: { cancelledCount: { increment: 1 } } });
    await audit({ actorId: actor.userId, action: "order.cancelled", entityType: "Order", entityId: order.id, before: { status: order.status }, after: { status: "CANCELLED", reason } }, tx);
  });
  // Reembolso fora da transação (chamada ao gateway); restock já feito acima.
  await refundOrder(order.id, actor.userId, { reason, restock: false }).catch(async (error) => {
    await audit({ actorId: actor.userId, action: "refund.requested", entityType: "Order", entityId: order.id, after: { error: error instanceof Error ? error.message : "falha", pending: true } });
  });
  await recomputeProductAggregates(order.items.map((i) => i.productId));
  await notifyStatus(order.id, "CANCELLED", { note: reason });
}

async function notifyStatus(orderId: string, to: OrderStatus, data: { trackingCode?: string; carrier?: string; trackingUrl?: string; note?: string } = {}) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { number: true, totalCents: true, userId: true, store: { select: { ownerId: true } } } });
  if (!order) return;
  const link = `/minha-conta/pedidos/${order.number}`;
  switch (to) {
    case "SHIPPED":
      await notify({ userId: order.userId, type: "ORDER_SHIPPED", title: "Pedido enviado", body: `O pedido ${order.number} está a caminho.`, link, email: orderShippedEmail(order, { code: data.trackingCode, carrier: data.carrier, url: data.trackingUrl }) });
      break;
    case "OUT_FOR_DELIVERY":
      await notify({ userId: order.userId, type: "ORDER_SHIPPED", title: "Saiu para entrega", body: `O pedido ${order.number} chega hoje!`, link });
      break;
    case "DELIVERED":
      await notify({ userId: order.userId, type: "ORDER_DELIVERED", title: "Pedido entregue", body: `O pedido ${order.number} foi entregue. Avalie sua compra!`, link, email: orderDeliveredEmail(order) });
      break;
    case "CANCELLED":
      await notify({ userId: order.userId, type: "ORDER_CANCELLED", title: "Pedido cancelado", body: `O pedido ${order.number} foi cancelado.`, link, email: orderCancelledEmail(order, data.note) });
      break;
    case "REFUND_REQUESTED":
      await notify({ userId: order.store.ownerId, type: "SYSTEM", title: "Solicitação de cancelamento/devolução", body: `O cliente solicitou cancelamento/devolução do pedido ${order.number}.`, link: `/vendedor/pedidos/${orderId}` });
      break;
    case "REFUNDED":
      await notify({ userId: order.userId, type: "SYSTEM", title: "Reembolso realizado", body: `O reembolso do pedido ${order.number} foi processado.`, link });
      break;
    default:
      break;
  }
}

/** Cliente: cancelar compra pendente ou solicitar cancelamento/devolução. */
export async function customerRequestCancellation(userId: string, orderNumber: string, reason: string) {
  const order = await db.order.findFirst({ where: { number: orderNumber, userId }, select: { id: true, status: true } });
  if (!order) throw notFound("Pedido não encontrado.");
  const actor: OrderActor = { userId, role: "CUSTOMER" };
  if (order.status === "PENDING_PAYMENT") return updateOrderStatus(order.id, "CANCELLED", actor, { note: reason });
  if (["PAID", "PROCESSING", "DELIVERED"].includes(order.status)) return updateOrderStatus(order.id, "REFUND_REQUESTED", actor, { note: reason });
  throw new AppError("UNPROCESSABLE", "Este pedido já foi enviado. Aguarde a entrega para solicitar devolução.");
}

/** Para o painel do vendedor: valida que o usuário é dono da loja do pedido. */
export function sellerActor(user: { id: string; storeId: string | null }): OrderActor {
  if (!user.storeId) throw forbidden();
  return { userId: user.id, role: "SELLER", storeId: user.storeId };
}
