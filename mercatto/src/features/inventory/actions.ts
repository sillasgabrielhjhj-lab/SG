"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requirePermission, requireSeller } from "@/server/auth/guards";
import { adjustStock, setMinStock } from "@/features/inventory/service";

const adjustSchema = z.object({
  variantId: z.string().min(1).max(64),
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "RETURN"]),
  quantity: z.coerce.number().int().min(1, "Quantidade inválida").max(1_000_000),
  /** Para ADJUSTMENT: direção do ajuste. */
  direction: z.enum(["up", "down"]).default("up"),
  reason: z.string().trim().min(3, "Informe o motivo").max(200),
});

const delta = (i: z.infer<typeof adjustSchema>) => (i.type === "OUT" || (i.type === "ADJUSTMENT" && i.direction === "down") ? -i.quantity : i.quantity);

export const sellerAdjustStockAction = createAction(adjustSchema, async (input) => {
  const user = await requireSeller();
  const result = await adjustStock({ kind: "store", storeId: user.storeId }, { variantId: input.variantId, delta: delta(input), type: input.type, reason: input.reason, actorId: user.id });
  revalidatePath("/vendedor/estoque");
  return ok(result, "Estoque atualizado.");
}, "inventory.seller_adjust");

export const adminAdjustStockAction = createAction(adjustSchema, async (input) => {
  const user = await requirePermission("admin:inventory");
  const result = await adjustStock({ kind: "admin" }, { variantId: input.variantId, delta: delta(input), type: input.type, reason: input.reason, actorId: user.id });
  revalidatePath("/admin/estoque");
  return ok(result, "Estoque atualizado.");
}, "inventory.admin_adjust");

const minSchema = z.object({ variantId: z.string().min(1).max(64), minStock: z.coerce.number().int().min(0).max(100_000) });

export const sellerSetMinStockAction = createAction(minSchema, async ({ variantId, minStock }) => {
  const user = await requireSeller();
  await setMinStock({ kind: "store", storeId: user.storeId }, variantId, minStock, user.id);
  revalidatePath("/vendedor/estoque");
  return ok(undefined, "Estoque mínimo salvo.");
}, "inventory.seller_min");

export const adminSetMinStockAction = createAction(minSchema, async ({ variantId, minStock }) => {
  const user = await requirePermission("admin:inventory");
  await setMinStock({ kind: "admin" }, variantId, minStock, user.id);
  revalidatePath("/admin/estoque");
  return ok(undefined, "Estoque mínimo salvo.");
}, "inventory.admin_min");
