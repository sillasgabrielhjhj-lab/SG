"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requirePermission, requireSeller } from "@/server/auth/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { productInputSchema, productStatusSchema, quickPriceSchema } from "@/features/products/schemas";
import {
  archiveOrDeleteProduct,
  createProduct,
  duplicateProduct,
  getOfficialStoreId,
  restoreProduct,
  setProductStatus,
  updateProduct,
  updateVariantPrice,
  type ProductScope,
} from "@/features/products/service";

const idSchema = z.object({ productId: z.string().min(1).max(64) });

async function sellerScope(): Promise<{ scope: ProductScope; actorId: string }> {
  const user = await requireSeller();
  await enforceRateLimit(`products:${user.id}`, 120, 60);
  return { scope: { kind: "store", storeId: user.storeId }, actorId: user.id };
}

async function adminScope(storeId?: string): Promise<{ scope: ProductScope; actorId: string }> {
  const user = await requirePermission("admin:catalog");
  return { scope: { kind: "admin", storeId: storeId ?? (await getOfficialStoreId()) }, actorId: user.id };
}

function revalidateProductPaths(slug?: string) {
  revalidatePath("/vendedor/produtos");
  revalidatePath("/admin/produtos");
  if (slug) revalidatePath(`/produto/${slug}`);
}

// ----------------------------------------------------------------------------
// Vendedor (escopo = loja do usuário)
// ----------------------------------------------------------------------------

export const sellerCreateProductAction = createAction(productInputSchema, async (input) => {
  const { scope, actorId } = await sellerScope();
  const result = await createProduct(scope, actorId, input);
  revalidateProductPaths(result.slug);
  return ok(result, input.status === "ACTIVE" ? "Produto publicado!" : "Produto salvo como rascunho.");
}, "products.seller_create");

export const sellerUpdateProductAction = createAction(
  z.object({ productId: z.string().min(1).max(64), input: productInputSchema }),
  async ({ productId, input }) => {
    const { scope, actorId } = await sellerScope();
    const result = await updateProduct(scope, actorId, productId, input);
    revalidateProductPaths(result.slug);
    return ok(result, "Alterações salvas.");
  },
  "products.seller_update",
);

export const sellerSetProductStatusAction = createAction(productStatusSchema, async ({ productId, status }) => {
  const { scope, actorId } = await sellerScope();
  await setProductStatus(scope, actorId, productId, status);
  revalidateProductPaths();
  return ok(undefined, status === "ACTIVE" ? "Anúncio ativado." : status === "PAUSED" ? "Anúncio pausado." : "Anúncio movido para rascunho.");
}, "products.seller_status");

export const sellerArchiveProductAction = createAction(idSchema, async ({ productId }) => {
  const { scope, actorId } = await sellerScope();
  const result = await archiveOrDeleteProduct(scope, actorId, productId);
  revalidateProductPaths();
  return ok(result, result.deleted ? "Rascunho excluído." : "Anúncio arquivado.");
}, "products.seller_archive");

export const sellerRestoreProductAction = createAction(idSchema, async ({ productId }) => {
  const { scope, actorId } = await sellerScope();
  await restoreProduct(scope, actorId, productId);
  revalidateProductPaths();
  return ok(undefined, "Anúncio restaurado como rascunho.");
}, "products.seller_restore");

export const sellerDuplicateProductAction = createAction(idSchema, async ({ productId }) => {
  const { scope, actorId } = await sellerScope();
  const result = await duplicateProduct(scope, actorId, productId);
  revalidateProductPaths();
  return ok(result, "Cópia criada como rascunho.");
}, "products.seller_duplicate");

export const sellerQuickPriceAction = createAction(quickPriceSchema, async (input) => {
  const { scope, actorId } = await sellerScope();
  await updateVariantPrice(scope, actorId, input);
  revalidateProductPaths();
  return ok(undefined, "Preço atualizado.");
}, "products.seller_price");

// ----------------------------------------------------------------------------
// Administrador (produtos oficiais Mercatto e moderação de qualquer loja)
// ----------------------------------------------------------------------------

export const adminCreateProductAction = createAction(
  z.object({ storeId: z.string().max(64).optional(), input: productInputSchema }),
  async ({ storeId, input }) => {
    const { scope, actorId } = await adminScope(storeId);
    const result = await createProduct(scope, actorId, input);
    revalidateProductPaths(result.slug);
    revalidatePath("/");
    return ok(result, input.status === "ACTIVE" ? "Produto publicado na loja!" : "Produto salvo como rascunho.");
  },
  "products.admin_create",
);

export const adminUpdateProductAction = createAction(
  z.object({ productId: z.string().min(1).max(64), input: productInputSchema }),
  async ({ productId, input }) => {
    const { scope, actorId } = await adminScope();
    const result = await updateProduct(scope, actorId, productId, input);
    revalidateProductPaths(result.slug);
    revalidatePath("/");
    return ok(result, "Alterações salvas.");
  },
  "products.admin_update",
);

export const adminSetProductStatusAction = createAction(productStatusSchema, async ({ productId, status }) => {
  const { scope, actorId } = await adminScope();
  await setProductStatus(scope, actorId, productId, status);
  revalidateProductPaths();
  revalidatePath("/");
  return ok(undefined, "Status atualizado.");
}, "products.admin_status");

export const adminArchiveProductAction = createAction(idSchema, async ({ productId }) => {
  const { scope, actorId } = await adminScope();
  const result = await archiveOrDeleteProduct(scope, actorId, productId);
  revalidateProductPaths();
  return ok(result, result.deleted ? "Rascunho excluído." : "Produto arquivado.");
}, "products.admin_archive");

export const adminRestoreProductAction = createAction(idSchema, async ({ productId }) => {
  const { scope, actorId } = await adminScope();
  await restoreProduct(scope, actorId, productId);
  revalidateProductPaths();
  return ok(undefined, "Produto restaurado como rascunho.");
}, "products.admin_restore");

export const adminDuplicateProductAction = createAction(idSchema, async ({ productId }) => {
  const { scope, actorId } = await adminScope();
  const result = await duplicateProduct(scope, actorId, productId);
  revalidateProductPaths();
  return ok(result, "Cópia criada como rascunho.");
}, "products.admin_duplicate");

export const adminQuickPriceAction = createAction(quickPriceSchema, async (input) => {
  const { scope, actorId } = await adminScope();
  await updateVariantPrice(scope, actorId, input);
  revalidateProductPaths();
  return ok(undefined, "Preço atualizado.");
}, "products.admin_price");

export const adminToggleFeaturedAction = createAction(
  z.object({ productId: z.string().min(1).max(64), featured: z.boolean() }),
  async ({ productId, featured }) => {
    const user = await requirePermission("admin:catalog");
    const { db } = await import("@/server/db");
    const { audit } = await import("@/server/observability/audit");
    await db.product.update({ where: { id: productId }, data: { isFeatured: featured } });
    await audit({ actorId: user.id, action: "product.updated", entityType: "Product", entityId: productId, after: { isFeatured: featured } });
    revalidateProductPaths();
    revalidatePath("/");
    return ok(undefined, featured ? "Produto destacado na home." : "Destaque removido.");
  },
  "products.admin_featured",
);
