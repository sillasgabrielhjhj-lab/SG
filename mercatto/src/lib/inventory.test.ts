import { describe, it, expect } from "vitest";

import { testPrisma as prisma } from "@/test/db";
import { createTestCategory, createTestSeller, createTestProduct } from "@/test/fixtures";
import { decrementInventoryOrThrow, restoreInventory, InsufficientStockError } from "@/lib/inventory";

/**
 * decrementInventoryOrThrow é o que impede dois checkouts concorrentes de
 * vender o mesmo último item duas vezes (o bug real que existia antes: uma
 * leitura de disponibilidade separada do decremento, com uma janela de
 * corrida no meio). A condição `quantity >= { gte }` dentro do próprio
 * UPDATE faz o banco resolver a corrida — não o código da aplicação.
 */
describe("decrementInventoryOrThrow", () => {
  it("decrementa quando há estoque suficiente", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    const product = await createTestProduct({ sellerId: seller.id, categoryId: category.id, stock: 10 });

    await prisma.$transaction((tx) =>
      decrementInventoryOrThrow(tx, { productId: product.id, variantId: null, quantity: 3, productName: product.name }),
    );

    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(7);
  });

  it("lança InsufficientStockError e não altera o estoque quando insuficiente", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    const product = await createTestProduct({ sellerId: seller.id, categoryId: category.id, stock: 2 });

    await expect(
      prisma.$transaction((tx) =>
        decrementInventoryOrThrow(tx, { productId: product.id, variantId: null, quantity: 5, productName: product.name }),
      ),
    ).rejects.toThrow(InsufficientStockError);

    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(2);
  });

  it("nunca deixa o estoque negativo sob concorrência (dois checkouts pro último item)", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    // Só 1 unidade em estoque — dois "checkouts" tentam levar 1 cada ao
    // mesmo tempo. Sem a condição atômica, os dois teriam sucesso e o
    // estoque iria a -1; com ela, exatamente um deve ganhar.
    const product = await createTestProduct({ sellerId: seller.id, categoryId: category.id, stock: 1 });

    const attempt = () =>
      prisma
        .$transaction((tx) =>
          decrementInventoryOrThrow(tx, { productId: product.id, variantId: null, quantity: 1, productName: product.name }),
        )
        .then(() => "ok" as const)
        .catch((error) => {
          if (error instanceof InsufficientStockError) return "insufficient" as const;
          throw error;
        });

    const results = await Promise.all([attempt(), attempt()]);

    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.filter((r) => r === "insufficient")).toHaveLength(1);

    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(0);
  });
});

describe("restoreInventory", () => {
  it("devolve a quantidade ao estoque", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    const product = await createTestProduct({ sellerId: seller.id, categoryId: category.id, stock: 5 });

    await prisma.$transaction((tx) =>
      decrementInventoryOrThrow(tx, { productId: product.id, variantId: null, quantity: 4, productName: product.name }),
    );
    await prisma.$transaction((tx) => restoreInventory(tx, { productId: product.id, variantId: null, quantity: 4 }));

    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity).toBe(5);
  });
});
