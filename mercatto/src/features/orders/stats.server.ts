import "server-only";
import { cache } from "react";
import { db } from "@/server/db";

/**
 * Vendas da loja exibidas ao público: pedidos pagos que não foram cancelados
 * nem reembolsados — contados direto dos pedidos (única fonte da verdade).
 */
export const countStoreSales = cache(async (storeId: string): Promise<number> =>
  db.order.count({ where: { storeId, paidAt: { not: null }, status: { notIn: ["CANCELLED", "REFUNDED"] } } }),
);
