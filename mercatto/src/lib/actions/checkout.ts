"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { getCartForUser, computeCartSummary } from "@/lib/data/cart";
import { getShippingOptions } from "@/lib/shipping";
import { getPaymentProvider } from "@/lib/payments/provider";
import { placeOrderSchema } from "@/lib/validation/checkout";
import { logAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/auth";

function generateOrderNumber() {
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `MKT-${year}-${suffix}`;
}

export type PlaceOrderState = ActionState & { orderNumber?: string };

export async function placeOrderAction(
  _prev: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  const user = await requireUser();

  const parsed = placeOrderSchema.safeParse({
    addressId: formData.get("addressId"),
    shippingOptionId: formData.get("shippingOptionId"),
    paymentMethod: formData.get("paymentMethod"),
    installments: formData.get("installments") ?? 1,
    cardNumber: formData.get("cardNumber") ?? undefined,
    cardName: formData.get("cardName") ?? undefined,
    cardExpiry: formData.get("cardExpiry") ?? undefined,
    cardCvv: formData.get("cardCvv") ?? undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Dados de checkout inválidos. Revise e tente novamente." };
  }

  const { addressId, shippingOptionId, paymentMethod, installments } = parsed.data;

  // --- Endereço: nunca confiar em nada vindo do cliente além do ID -------
  const address = await prisma.address.findFirst({ where: { id: addressId, userId: user.id } });
  if (!address) {
    return { status: "error", message: "Endereço inválido." };
  }

  // --- Carrinho: recarrega tudo do banco, preços/estoque recalculados ----
  const cart = await getCartForUser(user.id);
  if (cart.items.length === 0) {
    return { status: "error", message: "Seu carrinho está vazio." };
  }

  for (const item of cart.items) {
    if (!item.product.isActive) {
      return { status: "error", message: `O produto "${item.product.name}" não está mais disponível.` };
    }
    const inventory = item.variant?.inventory ?? item.product.inventory;
    const available = inventory ? inventory.quantity - inventory.reserved : 0;
    if (available < item.quantity) {
      return {
        status: "error",
        message: `Estoque insuficiente para "${item.product.name}". Ajuste a quantidade no carrinho.`,
      };
    }
  }

  const shippingOption = getShippingOptions(address.zipCode).find((o) => o.id === shippingOptionId);
  if (!shippingOption) {
    return { status: "error", message: "Opção de entrega inválida." };
  }

  const itemsForSummary = cart.items.map((item) => ({
    quantity: item.quantity,
    unitPriceCents: item.variant?.priceCents ?? item.product.priceCents,
  }));
  const summary = computeCartSummary(itemsForSummary, cart.coupon, shippingOption.costCents);

  const orderNumber = generateOrderNumber();

  // --- Cobrança (mock) -----------------------------------------------------
  const cardLast4 = parsed.data.cardNumber?.replace(/\D/g, "").slice(-4) ?? "0000";
  const chargeResult = await getPaymentProvider().charge({
    orderNumber,
    amountCents: summary.totalCents,
    payment:
      paymentMethod === "CREDIT_CARD"
        ? { method: "CREDIT_CARD", installments, cardLast4 }
        : { method: paymentMethod },
  });

  if (chargeResult.status === "DECLINED") {
    return { status: "error", message: "Pagamento recusado. Verifique os dados e tente novamente." };
  }

  const orderStatus = chargeResult.status === "APPROVED" ? "PAYMENT_APPROVED" : "AWAITING_PAYMENT";
  const paymentStatus = chargeResult.status === "APPROVED" ? "APPROVED" : "PENDING";

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: user.id,
        status: orderStatus,
        shippingAddressId: address.id,
        subtotalCents: summary.subtotalCents,
        shippingCents: summary.shippingCents,
        discountCents: summary.discountCents,
        totalCents: summary.totalCents,
        couponId: cart.coupon?.id ?? null,
      },
    });

    for (const item of cart.items) {
      const unitPriceCents = item.variant?.priceCents ?? item.product.priceCents;
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          sellerId: item.product.sellerId,
          productNameSnapshot: item.variant ? `${item.product.name} (${item.variant.name})` : item.product.name,
          unitPriceCents,
          quantity: item.quantity,
          totalCents: unitPriceCents * item.quantity,
        },
      });

      if (item.variantId) {
        await tx.inventory.updateMany({
          where: { variantId: item.variantId },
          data: { quantity: { decrement: item.quantity } },
        });
      } else {
        await tx.inventory.updateMany({
          where: { productId: item.productId },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { salesCount: { increment: item.quantity } },
      });
    }

    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: getPaymentProvider().name,
        method: paymentMethod,
        status: paymentStatus,
        amountCents: summary.totalCents,
        installments: paymentMethod === "CREDIT_CARD" ? installments : 1,
        externalReference: chargeResult.externalReference,
        paidAt: paymentStatus === "APPROVED" ? new Date() : null,
      },
    });

    await tx.shipment.create({
      data: {
        orderId: order.id,
        carrier: "Mercatto Entregas",
        estimatedDelivery: new Date(Date.now() + shippingOption.days * 24 * 60 * 60 * 1000),
      },
    });

    if (cart.coupon) {
      await tx.coupon.update({ where: { id: cart.coupon.id }, data: { usedCount: { increment: 1 } } });
    }

    if (cart.id) {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { couponId: null } });
    }
  });

  await logAudit({
    userId: user.id,
    action: "ORDER_PLACED",
    entityType: "Order",
    entityId: orderNumber,
    metadata: { totalCents: summary.totalCents, paymentMethod },
  });

  // Redireciona (em vez de devolver o estado de sucesso) para uma página
  // de confirmação com URL própria — assim um refresh do carrinho/header
  // depois do pedido não esbarra no guard de "carrinho vazio" de /checkout.
  redirect(`/pedido-confirmado/${orderNumber}`);
}
