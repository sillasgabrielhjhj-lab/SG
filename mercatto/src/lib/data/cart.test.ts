import { describe, it, expect } from "vitest";

import { testPrisma as prisma } from "@/test/db";
import { createTestCategory, createTestSeller, createTestProduct, createTestBuyer } from "@/test/fixtures";
import { getCartForUser, getCartItemCount } from "@/lib/data/cart";

describe("getCartForUser / getCartItemCount", () => {
  it("retorna carrinho vazio para usuário sem carrinho criado ainda", async () => {
    const buyer = await createTestBuyer();
    const cart = await getCartForUser(buyer.id);
    expect(cart.items).toHaveLength(0);

    const count = await getCartItemCount(buyer.id);
    expect(count).toBe(0);
  });

  it("retorna itens do carrinho com produto e estoque populados", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    const buyer = await createTestBuyer();
    const product = await createTestProduct({ sellerId: seller.id, categoryId: category.id, stock: 20 });

    const dbCart = await prisma.cart.create({ data: { userId: buyer.id } });
    await prisma.cartItem.create({ data: { cartId: dbCart.id, productId: product.id, quantity: 3 } });

    const cart = await getCartForUser(buyer.id);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(cart.items[0].product.id).toBe(product.id);
    expect(cart.items[0].product.inventory?.quantity).toBe(20);

    const count = await getCartItemCount(buyer.id);
    expect(count).toBe(3);
  });

  it("soma a quantidade de múltiplos itens no contador do carrinho", async () => {
    const category = await createTestCategory();
    const { seller } = await createTestSeller();
    const buyer = await createTestBuyer();
    const productA = await createTestProduct({ sellerId: seller.id, categoryId: category.id });
    const productB = await createTestProduct({ sellerId: seller.id, categoryId: category.id });

    const dbCart = await prisma.cart.create({ data: { userId: buyer.id } });
    await prisma.cartItem.create({ data: { cartId: dbCart.id, productId: productA.id, quantity: 2 } });
    await prisma.cartItem.create({ data: { cartId: dbCart.id, productId: productB.id, quantity: 5 } });

    const count = await getCartItemCount(buyer.id);
    expect(count).toBe(7);
  });

  it("getCartItemCount retorna 0 para userId nulo (visitante)", async () => {
    const count = await getCartItemCount(null);
    expect(count).toBe(0);
  });
});
