"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { slugify } from "@/lib/slugify";
import { logAudit } from "@/lib/audit";
import { getOfficialSeller } from "@/lib/data/seller";
import { parseProductFormData } from "@/lib/actions/product-form-parser";
import type { ActionState } from "@/lib/actions/auth";

/**
 * CRUD de produtos do vendedor oficial "Mercatto" — mesma validação e
 * mesmo <ProductForm /> da área do vendedor (src/lib/actions/seller.ts),
 * mas gated por ADMIN e resolvendo o seller por isOfficialStore, nunca
 * pelo usuário logado. Isso impede por construção que um vendedor externo
 * chegue nessas actions: elas nem aceitam um sellerId vindo do formulário,
 * sempre usam o vendedor oficial fixo do banco.
 */
async function requireOfficialSeller() {
  const seller = await getOfficialSeller();
  if (!seller) {
    throw new Error("Vendedor oficial 'Mercatto' não encontrado — rode o seed antes de usar este painel.");
  }
  return seller;
}

export async function createMercattoProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole(["ADMIN"]);
  const seller = await requireOfficialSeller();

  const parsed = parseProductFormData(formData);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (existingSku) {
    return { status: "error", fieldErrors: { sku: ["Já existe um produto com este SKU"] } };
  }

  let slug = slugify(data.name);
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
        costCents: data.costCents,
        promotionStartsAt: data.promotionStartsAt,
        promotionEndsAt: data.promotionEndsAt,
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

  await logAudit({ userId: admin.id, action: "MERCATTO_PRODUCT_CREATED", entityType: "Product", entityId: product.id });

  revalidatePath("/admin/produtos-mercatto");
  redirect("/admin/produtos-mercatto");
}

export async function updateMercattoProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole(["ADMIN"]);
  const seller = await requireOfficialSeller();

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
        costCents: data.costCents,
        promotionStartsAt: data.promotionStartsAt,
        promotionEndsAt: data.promotionEndsAt,
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

  await logAudit({ userId: admin.id, action: "MERCATTO_PRODUCT_UPDATED", entityType: "Product", entityId: productId });

  revalidatePath("/admin/produtos-mercatto");
  revalidatePath(`/produto/${existing.slug}`);
  return { status: "success", message: "Produto atualizado." };
}

export async function deleteMercattoProductAction(productId: string) {
  const admin = await requireRole(["ADMIN"]);
  const seller = await requireOfficialSeller();

  const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } });
  if (!product) return;

  const hasOrders = await prisma.orderItem.findFirst({ where: { productId } });

  if (hasOrders) {
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
  } else {
    await prisma.product.delete({ where: { id: productId } });
  }

  await logAudit({ userId: admin.id, action: "MERCATTO_PRODUCT_DELETED", entityType: "Product", entityId: productId });
  revalidatePath("/admin/produtos-mercatto");
}

export async function toggleMercattoProductActiveAction(productId: string) {
  const admin = await requireRole(["ADMIN"]);
  const seller = await requireOfficialSeller();

  const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } });
  if (!product) return;

  await prisma.product.update({ where: { id: productId }, data: { isActive: !product.isActive } });
  await logAudit({ userId: admin.id, action: "MERCATTO_PRODUCT_ACTIVE_TOGGLED", entityType: "Product", entityId: productId });
  revalidatePath("/admin/produtos-mercatto");
}

export async function toggleMercattoProductFeaturedAction(productId: string) {
  const admin = await requireRole(["ADMIN"]);
  const seller = await requireOfficialSeller();

  const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } });
  if (!product) return;

  await prisma.product.update({ where: { id: productId }, data: { isFeatured: !product.isFeatured } });
  await logAudit({ userId: admin.id, action: "MERCATTO_PRODUCT_FEATURED_TOGGLED", entityType: "Product", entityId: productId });
  revalidatePath("/admin/produtos-mercatto");
}
