"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { addToCartSchema, couponSchema } from "@/lib/validation/cart";
import type { ActionState } from "@/lib/actions/auth";

async function getOrCreateCart(userId: string) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

export async function addToCartAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = addToCartSchema.safeParse({
    productId: formData.get("productId"),
    variantId: formData.get("variantId") || null,
    quantity: formData.get("quantity") ?? 1,
  });

  if (!parsed.success) {
    return { status: "error", message: "Não foi possível adicionar este produto ao carrinho." };
  }

  const { productId, variantId, quantity } = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id: productId, isActive: true },
    include: {
      inventory: true,
      variants: { where: variantId ? { id: variantId } : undefined, include: { inventory: true } },
    },
  });

  if (!product) {
    return { status: "error", message: "Produto não encontrado." };
  }

  const inventory = variantId ? product.variants[0]?.inventory : product.inventory;
  const available = inventory ? inventory.quantity - inventory.reserved : 0;

  if (available < quantity) {
    return { status: "error", message: "Quantidade indisponível em estoque." };
  }

  const cart = await getOrCreateCart(user.id);

  const existingItem = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId, variantId: variantId ?? null },
  });

  const newQuantity = Math.min((existingItem?.quantity ?? 0) + quantity, available, 10);

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, variantId: variantId ?? null, quantity: newQuantity },
    });
  }

  revalidatePath("/carrinho");
  revalidatePath("/", "layout");
  return { status: "success", message: "Produto adicionado ao carrinho." };
}

export async function updateCartItemQuantityAction(itemId: string, quantity: number) {
  const user = await requireUser();

  if (quantity < 1) {
    await prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId: user.id } } });
    revalidatePath("/carrinho");
    return;
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId: user.id } },
    include: { product: { include: { inventory: true } }, variant: { include: { inventory: true } } },
  });
  if (!item) return;

  const inventory = item.variant?.inventory ?? item.product.inventory;
  const available = inventory ? inventory.quantity - inventory.reserved : 0;
  const clamped = Math.min(quantity, available, 10);

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: Math.max(1, clamped) } });
  revalidatePath("/carrinho");
}

export async function removeCartItemAction(itemId: string) {
  const user = await requireUser();
  await prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId: user.id } } });
  revalidatePath("/carrinho");
  revalidatePath("/", "layout");
}

export async function applyCouponAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = couponSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const code = parsed.data.code.toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date())) {
    return { status: "error", message: "Cupom inválido ou expirado." };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { status: "error", message: "Este cupom atingiu o limite de usos." };
  }

  const cart = await getOrCreateCart(user.id);
  await prisma.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } });

  revalidatePath("/carrinho");
  return { status: "success", message: `Cupom ${code} aplicado!` };
}

export async function removeCouponAction() {
  const user = await requireUser();
  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (cart) {
    await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
  }
  revalidatePath("/carrinho");
}
