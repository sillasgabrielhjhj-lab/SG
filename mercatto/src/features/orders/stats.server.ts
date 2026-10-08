import "server-only";
import { cache } from "react";
import { db } from "@/server/db";

/**
 * Vendas da loja exibidas ao público: pedidos pagos que não foram cancelados
 * nem reembolsados — contados direto dos pedidos (única fonte da verdade).
 */
/**
 * Unidades vendidas por produto: itens de pedidos pagos que não foram
 * cancelados nem reembolsados (uma consulta por lote de produtos).
 */
export async function soldUnitsByProduct(productIds: string[]): Promise<Map<string, number>> {
  if (!productIds.length) return new Map();
  const rows = await db.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, order: { paidAt: { not: null }, status: { notIn: ["CANCELLED", "REFUNDED"] } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

export const countStoreSales = cache(async (storeId: string): Promise<number> =>
  db.order.count({ where: { storeId, paidAt: { not: null }, status: { notIn: ["CANCELLED", "REFUNDED"] } } }),
);
