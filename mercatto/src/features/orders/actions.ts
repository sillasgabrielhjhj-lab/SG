"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requirePermission, requireSeller, requireUser } from "@/server/auth/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { optionalText } from "@/lib/validators/common";
import { customerRequestCancellation, sellerActor, updateOrderStatus } from "@/features/orders/service";
import { refundOrder } from "@/features/payments/service";

const statusEnum = z.enum(["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUND_REQUESTED", "REFUNDED"]);
const transitionSchema = z.object({
  orderId: z.string().min(1).max(64),
  to: statusEnum,
  trackingCode: optionalText(40),
  carrier: optionalText(60),
  trackingUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().max(300).optional()),
  note: optionalText(300),
});

export const customerCancelOrderAction = createAction(z.object({ number: z.string().min(4).max(20), reason: z.string().trim().min(3, "Conte o motivo").max(300) }), async ({ number, reason }) => {
  const user = await requireUser();
  await enforceRateLimit(`order-cancel:${user.id}`, 10, 3600);
  await customerRequestCancellation(user.id, number, reason);
  revalidatePath(`/minha-conta/pedidos/${number}`);
  revalidatePath("/minha-conta/pedidos");
  return ok(undefined, "Solicitação registrada.");
}, "orders.customer_cancel");

export const sellerUpdateOrderAction = createAction(transitionSchema, async ({ orderId, to, ...data }) => {
  const user = await requireSeller();
  await updateOrderStatus(orderId, to, sellerActor(user), data);
  revalidatePath(`/vendedor/pedidos/${orderId}`);
  revalidatePath("/vendedor/pedidos");
  return ok(undefined, "Pedido atualizado.");
}, "orders.seller_update");

export const adminUpdateOrderAction = createAction(transitionSchema, async ({ orderId, to, ...data }) => {
  const user = await requirePermission("admin:orders");
  await updateOrderStatus(orderId, to, { userId: user.id, role: "ADMIN" }, data);
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  return ok(undefined, "Pedido atualizado.");
}, "orders.admin_update");

export const adminRefundOrderAction = createAction(
  z.object({ orderId: z.string().min(1).max(64), amountCents: z.coerce.number().int().min(1).optional(), reason: z.string().trim().min(3).max(300), restock: z.boolean().default(false) }),
  async ({ orderId, amountCents, reason, restock }) => {
    const user = await requirePermission("admin:refunds");
    const result = await refundOrder(orderId, user.id, { amountCents, reason, restock });
    revalidatePath(`/admin/pedidos/${orderId}`);
    return ok(result, "Reembolso registrado.");
  },
  "orders.admin_refund",
);
