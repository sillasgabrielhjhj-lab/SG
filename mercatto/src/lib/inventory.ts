import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/** Lançado quando o estoque não cobre a quantidade pedida no momento exato
 * da escrita — nunca na checagem prévia, que pode estar desatualizada sob
 * concorrência. Quem chama deve fazer rollback da transação (lançar deixa
 * o `$transaction` do Prisma desfazer tudo sozinho) e traduzir pra uma
 * mensagem amigável. */
export class InsufficientStockError extends Error {
  constructor(public readonly productName: string) {
    super(`Estoque insuficiente para "${productName}".`);
    this.name = "InsufficientStockError";
  }
}

/**
 * Decrementa estoque de forma atômica: a condição `quantity >= { gte }` vai
 * dentro do próprio UPDATE, então o banco garante que a leitura e a escrita
 * acontecem como uma operação só — dois checkouts concorrentes pro último
 * item nunca conseguem os dois decrementar (o segundo encontra `count: 0`
 * linhas afetadas e falha). Uma checagem prévia (SELECT depois UPDATE)
 * teria uma janela de corrida; isso aqui não tem.
 */
export async function decrementInventoryOrThrow(
  tx: Prisma.TransactionClient,
  params: { productId: string; variantId: string | null; quantity: number; productName: string },
) {
  const where = params.variantId
    ? { variantId: params.variantId, quantity: { gte: params.quantity } }
    : { productId: params.productId, quantity: { gte: params.quantity } };

  const result = await tx.inventory.updateMany({
    where,
    data: { quantity: { decrement: params.quantity } },
  });

  if (result.count === 0) {
    throw new InsufficientStockError(params.productName);
  }
}

export async function restoreInventory(
  tx: Prisma.TransactionClient,
  params: { productId: string; variantId: string | null; quantity: number },
) {
  if (params.variantId) {
    await tx.inventory.updateMany({
      where: { variantId: params.variantId },
      data: { quantity: { increment: params.quantity } },
    });
  } else {
    await tx.inventory.updateMany({
      where: { productId: params.productId },
      data: { quantity: { increment: params.quantity } },
    });
  }
}
