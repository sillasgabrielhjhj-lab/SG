"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { CANCELLABLE_STATUSES, RETURNABLE_STATUSES } from "@/lib/order-status";
import { restoreInventory } from "@/lib/inventory";
import type { ActionState } from "@/lib/actions/auth";

const cancelSchema = z.object({
  orderNumber: z.string(),
  reason: z.string().trim().min(3, "Conte brevemente o motivo").max(300),
});

export async function cancelOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = cancelSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const order = await prisma.order.findFirst({
    where: { orderNumber: parsed.data.orderNumber, userId: user.id },
    include: { items: true },
  });
  if (!order) {
    return { status: "error", message: "Pedido não encontrado." };
  }
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return { status: "error", message: "Este pedido não pode mais ser cancelado." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: parsed.data.reason },
    });

    for (const item of order.items) {
      await restoreInventory(tx, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }
  });

  await logAudit({ userId: user.id, action: "ORDER_CANCELLED", entityType: "Order", entityId: order.id });

  revalidatePath("/minha-conta/pedidos");
  revalidatePath(`/minha-conta/pedidos/${order.orderNumber}`);
  return { status: "success", message: "Pedido cancelado." };
}

const returnSchema = z.object({
  orderNumber: z.string(),
  reason: z.string().trim().min(3, "Conte brevemente o motivo").max(300),
});

export async function requestReturnAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = returnSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const order = await prisma.order.findFirst({
    where: { orderNumber: parsed.data.orderNumber, userId: user.id },
  });
  if (!order) {
    return { status: "error", message: "Pedido não encontrado." };
  }
  if (!RETURNABLE_STATUSES.includes(order.status)) {
    return { status: "error", message: "Este pedido não está elegível para devolução." };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { returnRequestedAt: new Date(), returnReason: parsed.data.reason },
  });

  await logAudit({ userId: user.id, action: "ORDER_RETURN_REQUESTED", entityType: "Order", entityId: order.id });

  revalidatePath(`/minha-conta/pedidos/${order.orderNumber}`);
  return { status: "success", message: "Solicitação de devolução enviada." };
}
