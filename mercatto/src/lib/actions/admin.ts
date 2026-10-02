"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { slugify } from "@/lib/slugify";
import { logAudit } from "@/lib/audit";
import { categorySchema, couponSchema } from "@/lib/validation/admin";
import type { ActionState } from "@/lib/actions/auth";
import type { Role } from "@/generated/prisma/enums";

const VALID_ROLES: Role[] = ["USER", "SELLER", "ADMIN"];

export async function updateUserRoleAction(userId: string, role: string) {
  const admin = await requireRole(["ADMIN"]);
  if (!VALID_ROLES.includes(role as Role)) return;
  if (userId === admin.id) return; // admin não pode mudar o próprio papel por aqui

  await prisma.user.update({ where: { id: userId }, data: { role: role as Role } });
  await logAudit({ userId: admin.id, action: "USER_ROLE_CHANGED", entityType: "User", entityId: userId, metadata: { role } });
  revalidatePath("/admin/usuarios");
}

export async function toggleSellerVerifiedAction(sellerId: string) {
  const admin = await requireRole(["ADMIN"]);
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) return;

  await prisma.seller.update({ where: { id: sellerId }, data: { isVerified: !seller.isVerified } });
  await logAudit({ userId: admin.id, action: "SELLER_VERIFIED_TOGGLED", entityType: "Seller", entityId: sellerId });
  revalidatePath("/admin/vendedores");
}

export async function toggleProductActiveAdminAction(productId: string) {
  const admin = await requireRole(["ADMIN"]);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  await prisma.product.update({ where: { id: productId }, data: { isActive: !product.isActive } });
  await logAudit({ userId: admin.id, action: "PRODUCT_ACTIVE_TOGGLED", entityType: "Product", entityId: productId });
  revalidatePath("/admin/produtos");
}

export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole(["ADMIN"]);

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId") || null,
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let slug = slugify(parsed.data.name);
  const taken = await prisma.category.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${Date.now().toString(36)}`;

  await prisma.category.create({
    data: { name: parsed.data.name, slug, parentId: parsed.data.parentId },
  });

  await logAudit({ userId: admin.id, action: "CATEGORY_CREATED", entityType: "Category", entityId: slug });
  revalidatePath("/admin/categorias");
  return { status: "success", message: "Categoria criada." };
}

export async function deleteCategoryAction(categoryId: string) {
  const admin = await requireRole(["ADMIN"]);

  const hasProducts = await prisma.product.findFirst({ where: { categoryId } });
  const hasChildren = await prisma.category.findFirst({ where: { parentId: categoryId } });
  if (hasProducts || hasChildren) return;

  await prisma.category.delete({ where: { id: categoryId } });
  await logAudit({ userId: admin.id, action: "CATEGORY_DELETED", entityType: "Category", entityId: categoryId });
  revalidatePath("/admin/categorias");
}

export async function createCouponAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole(["ADMIN"]);

  const type = formData.get("type") as string;
  const rawValue = Number(formData.get("value") ?? 0);

  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    type,
    value: type === "FIXED" ? Math.round(rawValue * 100) : rawValue,
    minOrderCents: Math.round(Number(formData.get("minOrder") ?? 0) * 100),
    maxUses: formData.get("maxUses") ? Number(formData.get("maxUses")) : null,
    expiresAt: formData.get("expiresAt") || null,
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const code = parsed.data.code.toUpperCase();
  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) {
    return { status: "error", fieldErrors: { code: ["Já existe um cupom com este código"] } };
  }

  await prisma.coupon.create({
    data: {
      code,
      type: parsed.data.type,
      value: parsed.data.value,
      minOrderCents: parsed.data.minOrderCents,
      maxUses: parsed.data.maxUses,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });

  await logAudit({ userId: admin.id, action: "COUPON_CREATED", entityType: "Coupon", entityId: code });
  revalidatePath("/admin/cupons");
  return { status: "success", message: "Cupom criado." };
}

export async function toggleCouponActiveAction(couponId: string) {
  const admin = await requireRole(["ADMIN"]);
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) return;

  await prisma.coupon.update({ where: { id: couponId }, data: { isActive: !coupon.isActive } });
  await logAudit({ userId: admin.id, action: "COUPON_ACTIVE_TOGGLED", entityType: "Coupon", entityId: couponId });
  revalidatePath("/admin/cupons");
}

export async function deleteReviewAction(reviewId: string) {
  const admin = await requireRole(["ADMIN"]);
  await prisma.review.delete({ where: { id: reviewId } }).catch(() => {});
  await logAudit({ userId: admin.id, action: "REVIEW_DELETED", entityType: "Review", entityId: reviewId });
  revalidatePath("/admin/avaliacoes");
}
