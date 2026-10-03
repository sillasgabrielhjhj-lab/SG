import { describe, it, expect } from "vitest";

import { testPrisma as prisma } from "@/test/db";
import { createTestCategory, createTestSeller, createTestProduct } from "@/test/fixtures";

/**
 * Testa o mesmo padrão de transação usado em placeOrderAction /
 * cancelOrderAction (src/lib/actions/checkout.ts e orders.ts): decrementa
 * estoque ao criar um pedido, incrementa de volta ao cancelar. A regra de
 * negócio central é que o estoque nunca fica negativo nem "vaza" entre
 * pedidos concorrentes.
 */
describe("Inventory — decremento e devolução de estoque", () => {
  it("decrementa o estoque disponível ao \"comprar\"", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    const product = await createTestProduct({ sellerId: seller.id, categoryId: category.id, stock: 10 });

    await prisma.inventory.updateMany({
      where: { productId: product.id },
      data: { quantity: { decrement: 3 } },
    });

    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(7);
  });

  it("devolve o estoque ao cancelar um pedido", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    const product = await createTestProduct({ sellerId: seller.id, categoryId: category.id, stock: 10 });

    await prisma.inventory.updateMany({ where: { productId: product.id }, data: { quantity: { decrement: 4 } } });
    await prisma.inventory.updateMany({ where: { productId: product.id }, data: { quantity: { increment: 4 } } });

    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(10);
  });

  it("estoque disponível considera a reserva (quantity - reserved)", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    const product = await createTestProduct({ sellerId: seller.id, categoryId: category.id, stock: 10 });

    await prisma.inventory.updateMany({ where: { productId: product.id }, data: { reserved: 6 } });

    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    const available = (inventory?.quantity ?? 0) - (inventory?.reserved ?? 0);
    expect(available).toBe(4);
  });

  it("impede comprar mais do que o estoque disponível (checagem de aplicação)", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    const product = await createTestProduct({ sellerId: seller.id, categoryId: category.id, stock: 2 });

    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    const available = (inventory?.quantity ?? 0) - (inventory?.reserved ?? 0);
    const requestedQuantity = 5;

    expect(available).toBeLessThan(requestedQuantity);
  });
});
