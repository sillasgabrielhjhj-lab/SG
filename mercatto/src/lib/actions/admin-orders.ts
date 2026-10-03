"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { getOfficialSeller } from "@/lib/data/seller";
import { SELLER_NEXT_STATUS, STATUS_ADVANCE_NOTIFICATION } from "@/lib/order-status";
import type { ActionState } from "@/lib/actions/auth";

/**
 * Avança o status de um pedido que inclui produtos do vendedor oficial
 * Mercatto — mesma lógica de advanceOrderStatusAction (src/lib/actions/
 * seller.ts), mas pro caso em que não existe um vendedor "de verdade"
 * logado pra fazer isso: a conta dona do Seller oficial é só um registro
 * técnico (senha aleatória, ninguém loga nela), então quem cumpre o pedido
 * é qualquer admin, autenticado como admin mesmo, não como esse vendedor.
 */
export async function advanceMercattoOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole(["ADMIN"]);
  const seller = await getOfficialSeller();
  if (!seller) return { status: "error", message: "Vendedor oficial 'Mercatto' não encontrado." };

  const orderNumber = formData.get("orderNumber") as string;
  const trackingCode = (formData.get("trackingCode") as string | null)?.trim() || undefined;

  const order = await prisma.order.findFirst({
    where: { orderNumber, items: { some: { sellerId: seller.id } } },
  });
  if (!order) return { status: "error", message: "Pedido não encontrado." };

  const nextStatus = SELLER_NEXT_STATUS[order.status];
  if (!nextStatus) {
    return { status: "error", message: "Este pedido não pode avançar de status." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: nextStatus as never } });

    if (nextStatus === "SHIPPED") {
      await tx.shipment.update({
        where: { orderId: order.id },
        data: { shippedAt: new Date(), trackingCode },
      });
    }
    if (nextStatus === "DELIVERED") {
      await tx.shipment.update({ where: { orderId: order.id }, data: { deliveredAt: new Date() } });
    }
  });

  await logAudit({
    userId: admin.id,
    action: "MERCATTO_ORDER_STATUS_ADVANCED",
    entityType: "Order",
    entityId: order.id,
    metadata: { from: order.status, to: nextStatus },
  });

  const notification = STATUS_ADVANCE_NOTIFICATION[nextStatus];
  if (notification) {
    await notifyUser({
      userId: order.userId,
      type: "ORDER_UPDATE",
      title: notification.title,
      message: notification.message,
      linkUrl: `/minha-conta/pedidos/${orderNumber}`,
    });
  }

  revalidatePath(`/admin/pedidos-mercatto/${orderNumber}`);
  revalidatePath("/admin/pedidos-mercatto");
  return { status: "success", message: "Status do pedido atualizado." };
}
