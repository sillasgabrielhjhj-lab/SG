"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { slugify } from "@/lib/slugify";
import { logAudit } from "@/lib/audit";
import { becomeSellerSchema } from "@/lib/validation/seller";
import { productSchema } from "@/lib/validation/product";
import type { ActionState } from "@/lib/actions/auth";

export async function becomeSellerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const existing = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (existing) {
    return { status: "error", message: "Você já tem uma loja cadastrada." };
  }

  const parsed = becomeSellerSchema.safeParse({
    storeName: formData.get("storeName"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let slug = slugify(parsed.data.storeName);
  const slugTaken = await prisma.seller.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${user.id.slice(0, 6)}`;

  await prisma.$transaction([
    prisma.seller.create({
      data: {
        userId: user.id,
        storeName: parsed.data.storeName,
        slug,
        description: parsed.data.description || null,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { role: "SELLER" } }),
  ]);

  await logAudit({ userId: user.id, action: "SELLER_CREATED", entityType: "Seller", entityId: user.id });

  revalidatePath("/vendedor");
  redirect("/vendedor");
}

function parseProductFormData(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    brandId: formData.get("brandId") || null,
    sku: formData.get("sku"),
    priceCents: Math.round(Number(formData.get("price") ?? 0) * 100),
    compareAtPriceCents: formData.get("compareAtPrice")
      ? Math.round(Number(formData.get("compareAtPrice")) * 100)
      : null,
    weightGrams: formData.get("weightGrams") ? Number(formData.get("weightGrams")) : null,
    heightCm: formData.get("heightCm") ? Number(formData.get("heightCm")) : null,
    widthCm: formData.get("widthCm") ? Number(formData.get("widthCm")) : null,
    lengthCm: formData.get("lengthCm") ? Number(formData.get("lengthCm")) : null,
    stock: Number(formData.get("stock") ?? 0),
    images: JSON.parse((formData.get("imagesJson") as string) || "[]"),
    attributes: JSON.parse((formData.get("attributesJson") as string) || "[]"),
    variants: JSON.parse((formData.get("variantsJson") as string) || "[]"),
  };
  return productSchema.safeParse(raw);
}

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole(["SELLER", "ADMIN"]);
  const seller = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!seller) return { status: "error", message: "Loja não encontrada." };

  const parsed = parseProductFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (existingSku) {
    return { status: "error", fieldErrors: { sku: ["Já existe um produto com este SKU"] } };
  }

  let slug = `${slugify(data.name)}`;
  const slugTaken = await prisma.product.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${data.sku.toLowerCase()}`;

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        sellerId: seller.id,
        categoryId: data.categoryId,
        brandId: data.brandId,
        name: data.name,
        slug,
        description: data.description,
        sku: data.sku,
        priceCents: data.priceCents,
        compareAtPriceCents: data.compareAtPriceCents,
        weightGrams: data.weightGrams,
        heightCm: data.heightCm,
        widthCm: data.widthCm,
        lengthCm: data.lengthCm,
        images: {
          create: data.images.map((img, i) => ({ url: img.url, altText: img.altText || data.name, position: i })),
        },
        attributes: { create: data.attributes },
      },
    });

    if (data.variants.length > 0) {
      for (const variant of data.variants) {
        await tx.productVariant.create({
          data: {
            productId: created.id,
            name: variant.name,
            sku: variant.sku,
            priceCents: variant.priceCents,
            attributes: {},
            inventory: { create: { quantity: variant.stock } },
          },
        });
      }
    } else {
      await tx.inventory.create({ data: { productId: created.id, quantity: data.stock } });
    }

    return created;
  });

  await logAudit({ userId: user.id, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.id });

  revalidatePath("/vendedor/produtos");
  redirect("/vendedor/produtos");
}

export async function updateProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole(["SELLER", "ADMIN"]);
  const seller = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!seller) return { status: "error", message: "Loja não encontrada." };

  const productId = formData.get("productId") as string;
  const existing = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } });
  if (!existing) return { status: "error", message: "Produto não encontrado." };

  const parsed = parseProductFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const skuOwner = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (skuOwner && skuOwner.id !== productId) {
    return { status: "error", fieldErrors: { sku: ["Já existe um produto com este SKU"] } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        categoryId: data.categoryId,
        brandId: data.brandId,
        name: data.name,
        description: data.description,
        sku: data.sku,
        priceCents: data.priceCents,
        compareAtPriceCents: data.compareAtPriceCents,
        weightGrams: data.weightGrams,
        heightCm: data.heightCm,
        widthCm: data.widthCm,
        lengthCm: data.lengthCm,
      },
    });

    await tx.productImage.deleteMany({ where: { productId } });
    await tx.productImage.createMany({
      data: data.images.map((img, i) => ({
        productId,
        url: img.url,
        altText: img.altText || data.name,
        position: i,
      })),
    });

    await tx.productAttribute.deleteMany({ where: { productId } });
    if (data.attributes.length > 0) {
      await tx.productAttribute.createMany({
        data: data.attributes.map((attr) => ({ productId, ...attr })),
      });
    }

    if (data.variants.length === 0) {
      await tx.inventory.upsert({
        where: { productId },
        update: { quantity: data.stock },
        create: { productId, quantity: data.stock },
      });
    } else {
      await tx.inventory.deleteMany({ where: { productId } });
    }
  });

  await logAudit({ userId: user.id, action: "PRODUCT_UPDATED", entityType: "Product", entityId: productId });

  revalidatePath("/vendedor/produtos");
  revalidatePath(`/produto/${existing.slug}`);
  return { status: "success", message: "Produto atualizado." };
}

export async function deleteProductAction(productId: string) {
  const user = await requireRole(["SELLER", "ADMIN"]);
  const seller = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!seller) return;

  const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } });
  if (!product) return;

  const hasOrders = await prisma.orderItem.findFirst({ where: { productId } });

  if (hasOrders) {
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
  } else {
    await prisma.product.delete({ where: { id: productId } });
  }

  await logAudit({ userId: user.id, action: "PRODUCT_DELETED", entityType: "Product", entityId: productId });
  revalidatePath("/vendedor/produtos");
}

export async function toggleProductActiveAction(productId: string) {
  const user = await requireRole(["SELLER", "ADMIN"]);
  const seller = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!seller) return;

  const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } });
  if (!product) return;

  await prisma.product.update({ where: { id: productId }, data: { isActive: !product.isActive } });
  revalidatePath("/vendedor/produtos");
}

const SELLER_NEXT_STATUS: Record<string, string> = {
  PAYMENT_APPROVED: "PREPARING_SHIPMENT",
  PREPARING_SHIPMENT: "SHIPPED",
  SHIPPED: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

export async function advanceOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole(["SELLER", "ADMIN"]);
  const seller = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!seller) return { status: "error", message: "Loja não encontrada." };

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
    userId: user.id,
    action: "ORDER_STATUS_ADVANCED",
    entityType: "Order",
    entityId: order.id,
    metadata: { from: order.status, to: nextStatus },
  });

  revalidatePath(`/vendedor/pedidos/${orderNumber}`);
  revalidatePath("/vendedor/pedidos");
  return { status: "success", message: "Status do pedido atualizado." };
}
