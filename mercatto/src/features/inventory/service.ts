import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { audit } from "@/server/observability/audit";
import { notify } from "@/features/notifications/service";
import { lowStockEmail } from "@/features/notifications/templates";
import { recomputeProductAggregates } from "@/features/catalog/aggregates";

export type StockScope = { kind: "store"; storeId: string } | { kind: "admin" };

/**
 * Movimentação manual de estoque (entrada, saída, ajuste, devolução). Atômica:
 * saídas só ocorrem se houver saldo (nunca negativo — também garantido por
 * CHECK no banco). Registra histórico, auditoria e alerta de estoque baixo.
 */
export async function adjustStock(
  scope: StockScope,
  input: { variantId: string; delta: number; type: "IN" | "OUT" | "ADJUSTMENT" | "RETURN"; reason: string; actorId: string },
) {
  if (!Number.isInteger(input.delta) || input.delta === 0) throw new AppError("VALIDATION", "Informe uma quantidade diferente de zero.");
  if ((input.type === "IN" || input.type === "RETURN") && input.delta < 0) throw new AppError("VALIDATION", "Entradas devem ser positivas.");
  if (input.type === "OUT" && input.delta > 0) throw new AppError("VALIDATION", "Saídas devem ser negativas.");
  const variant = await db.productVariant.findUnique({
    where: { id: input.variantId },
    select: { id: true, sku: true, name: true, stock: true, minStock: true, productId: true, product: { select: { name: true, storeId: true, store: { select: { ownerId: true } } } } },
  });
  if (!variant) throw notFound("Variação não encontrada.");
  if (scope.kind === "store" && variant.product.storeId !== scope.storeId) throw notFound("Variação não encontrada.");

  const balance = await db.$transaction(async (tx) => {
    const where: Prisma.ProductVariantWhereInput = input.delta < 0 ? { id: variant.id, stock: { gte: -input.delta } } : { id: variant.id };
    const { count } = await tx.productVariant.updateMany({ where, data: { stock: { increment: input.delta } } });
    if (count !== 1) throw new AppError("UNPROCESSABLE", "Saldo insuficiente para esta saída.");
    const updated = await tx.productVariant.findUniqueOrThrow({ where: { id: variant.id }, select: { stock: true } });
    await tx.inventoryMovement.create({ data: { variantId: variant.id, type: input.type, quantity: input.delta, balanceAfter: updated.stock, reason: input.reason, actorId: input.actorId } });
    await audit({ actorId: input.actorId, action: "inventory.adjusted", entityType: "ProductVariant", entityId: variant.id, before: { stock: variant.stock }, after: { stock: updated.stock, type: input.type, reason: input.reason } }, tx);
    return updated.stock;
  });

  if (balance <= variant.minStock && variant.stock > variant.minStock) {
    await notify({
      userId: variant.product.store.ownerId,
      type: "LOW_STOCK",
      title: "Estoque baixo",
      body: `${variant.product.name} (${variant.name}) está com ${balance} unidade(s).`,
      link: "/vendedor/estoque",
      email: lowStockEmail(variant.product.name, variant.name, balance),
    });
  }
  await recomputeProductAggregates([variant.productId]);
  return { stock: balance };
}

export async function setMinStock(scope: StockScope, variantId: string, minStock: number, actorId: string) {
  const variant = await db.productVariant.findUnique({ where: { id: variantId }, select: { minStock: true, product: { select: { storeId: true } } } });
  if (!variant || (scope.kind === "store" && variant.product.storeId !== scope.storeId)) throw notFound("Variação não encontrada.");
  await db.productVariant.update({ where: { id: variantId }, data: { minStock } });
  await audit({ actorId, action: "inventory.adjusted", entityType: "ProductVariant", entityId: variantId, before: { minStock: variant.minStock }, after: { minStock } });
}

const PAGE = 25;

/** Histórico de movimentações (escopo por loja). */
export async function listMovements(scope: StockScope, filters: { variantId?: string; productId?: string; type?: string; page?: number } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.InventoryMovementWhereInput = {
    ...(scope.kind === "store" ? { variant: { product: { storeId: scope.storeId } } } : {}),
    ...(filters.variantId ? { variantId: filters.variantId } : {}),
    ...(filters.productId ? { variant: { productId: filters.productId, ...(scope.kind === "store" ? { product: { storeId: scope.storeId } } : {}) } } : {}),
    ...(filters.type ? { type: filters.type as Prisma.InventoryMovementWhereInput["type"] } : {}),
  };
  const [items, total] = await Promise.all([
    db.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, type: true, quantity: true, balanceAfter: true, reason: true, createdAt: true,
        actor: { select: { name: true } },
        order: { select: { number: true } },
        variant: { select: { sku: true, name: true, product: { select: { name: true, store: { select: { name: true } } } } } },
      },
    }),
    db.inventoryMovement.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

/** Lista de variantes para a tela de estoque (busca + filtro de estoque baixo). */
export async function listStockVariants(scope: StockScope, filters: { q?: string; lowOnly?: boolean; lowThreshold?: number; page?: number } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.ProductVariantWhereInput = {
    product: { status: { not: "ARCHIVED" }, ...(scope.kind === "store" ? { storeId: scope.storeId } : {}) },
    ...(filters.q ? { OR: [{ sku: { contains: filters.q, mode: "insensitive" } }, { product: { name: { contains: filters.q, mode: "insensitive" } } }] } : {}),
  };
  const rows = await db.productVariant.findMany({
    where,
    orderBy: [{ stock: "asc" }, { sku: "asc" }],
    select: { id: true, sku: true, name: true, stock: true, minStock: true, status: true, product: { select: { id: true, name: true, store: { select: { name: true, isOfficial: true } }, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } } },
    take: filters.lowOnly ? 500 : PAGE,
    skip: filters.lowOnly ? 0 : (page - 1) * PAGE,
  });
  const items = filters.lowOnly ? rows.filter((r) => r.stock <= Math.max(r.minStock, filters.lowThreshold ?? 0)) : rows;
  const total = filters.lowOnly ? items.length : await db.productVariant.count({ where });
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}
