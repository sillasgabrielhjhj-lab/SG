import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MercadoPagoConfig, Payment as MPPayment } from "mercadopago";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { restoreInventory } from "@/lib/inventory";

/**
 * Notificação do Mercado Pago (Checkout Pro). O corpo do POST nunca é
 * confiado diretamente — ele só diz "um pagamento mudou, aqui está o id";
 * buscamos o status de verdade na API do Mercado Pago usando nosso
 * próprio Access Token, que é a única fonte confiável de autorização
 * aqui (não há sessão de usuário numa chamada servidor-a-servidor).
 */
export async function POST(request: NextRequest) {
  let paymentId: string | null = null;

  try {
    const body = await request.json();
    if (body?.type === "payment" && body?.data?.id) {
      paymentId = String(body.data.id);
    }
  } catch {
    // corpo vazio/inválido — tenta os query params (formato IPN legado)
  }

  if (!paymentId) {
    const topic = request.nextUrl.searchParams.get("topic") ?? request.nextUrl.searchParams.get("type");
    const id = request.nextUrl.searchParams.get("id") ?? request.nextUrl.searchParams.get("data.id");
    if (topic === "payment" && id) paymentId = id;
  }

  if (!paymentId) {
    // Outro tipo de notificação (merchant_order, etc.) — confirma recebimento e ignora.
    return NextResponse.json({ received: true });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("Webhook Mercado Pago recebido, mas MERCADOPAGO_ACCESS_TOKEN não está configurado.");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const client = new MercadoPagoConfig({ accessToken });
  const payment = await new MPPayment(client).get({ id: paymentId });

  const orderNumber = payment.external_reference;
  if (!orderNumber) {
    return NextResponse.json({ received: true });
  }

  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
  if (!order) {
    return NextResponse.json({ received: true });
  }

  const mpStatus = payment.status;
  const paymentStatus =
    mpStatus === "approved"
      ? "APPROVED"
      : mpStatus === "refunded" || mpStatus === "charged_back"
        ? "REFUNDED"
        : mpStatus === "rejected" || mpStatus === "cancelled"
          ? "DECLINED"
          : "PENDING";

  // Pedido ainda não pago e o pagamento foi recusado/cancelado no gateway:
  // o estoque já tinha sido reservado (decrementado) na criação do pedido
  // — sem isso aqui, ele fica perdido pra sempre a cada pagamento que falha.
  // Uma reprovação em pedido já aprovado (reembolso/chargeback após o fato)
  // não entra nesse caso: o produto pode já ter saído pra entrega, então
  // isso fica pra revisão manual em vez de estorno automático de estoque.
  const shouldReleaseStock = paymentStatus === "DECLINED" && order.status === "AWAITING_PAYMENT";

  await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { orderId: order.id },
      data: {
        status: paymentStatus,
        externalReference: String(payment.id),
        paidAt: paymentStatus === "APPROVED" ? new Date() : null,
      },
    });

    if (paymentStatus === "APPROVED" && order.status === "AWAITING_PAYMENT") {
      await tx.order.update({ where: { id: order.id }, data: { status: "PAYMENT_APPROVED" } });
    }

    if (shouldReleaseStock) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: "Pagamento não aprovado pelo Mercado Pago.",
        },
      });
      for (const item of order.items) {
        await restoreInventory(tx, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        });
      }
    }
  });

  if (paymentStatus === "APPROVED" && order.status === "AWAITING_PAYMENT") {
    await notifyUser({
      userId: order.userId,
      type: "ORDER_UPDATE",
      title: "Pagamento aprovado!",
      message: `O pagamento do pedido ${order.orderNumber} foi aprovado.`,
      linkUrl: `/minha-conta/pedidos/${order.orderNumber}`,
    });
  }

  await logAudit({
    userId: null,
    action: "PAYMENT_WEBHOOK",
    entityType: "Order",
    entityId: orderNumber,
    metadata: { mpPaymentId: payment.id, mpStatus, paymentStatus },
  });

  return NextResponse.json({ received: true });
}
