import { test, expect } from "@playwright/test";
import path from "node:path";

import { registerUser, login, submitAndWait, uniqueEmail, DEFAULT_PASSWORD } from "./helpers";

const TEST_IMAGE = path.join(__dirname, "fixtures", "test-image.png");

/**
 * Cobre o marketplace híbrido: o admin cadastra um produto como o vendedor
 * oficial "Mercatto" (sem precisar de loja própria, diferente do vendedor
 * externo), ele aparece na vitrine como "Vendido por Mercatto", e o
 * carrinho aceita ele junto com um produto de vendedor externo — a mesma
 * regra de negócio que já existia pro carrinho multi-vendedor, agora
 * também cobrindo o caso do vendedor oficial.
 */
test.describe("Loja oficial Mercatto", () => {
  test("admin cadastra produto do Mercatto e ele aparece na vitrine como vendido pela Mercatto", async ({ page }) => {
    await login(page, "admin@mercatto.dev", "Senha123!");

    const productName = `Produto Mercatto E2E ${Date.now()}`;
    await page.goto("/admin/produtos-mercatto/novo", { waitUntil: "networkidle" });
    await page.fill("#name", productName);
    await page.fill("#description", "Produto oficial da Mercatto cadastrado pelo teste automatizado.");
    await page.selectOption("#categoryId", { index: 1 });
    await page.fill("#sku", `E2E-MERCATTO-${Date.now()}`);

    await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);
    await page.waitForTimeout(1200);

    await page.fill("#price", "99.90");
    await page.fill("#stock", "20");
    await submitAndWait(page, 'button:has-text("Cadastrar produto")');

    await expect(page.getByText(productName)).toBeVisible();

    // Busca o produto recém-criado na vitrine pública e confirma o selo
    // de vendedor oficial.
    await page.goto(`/search?q=${encodeURIComponent(productName)}`, { waitUntil: "networkidle" });
    const productHref = await page.locator("a[href^='/produto/']").first().getAttribute("href");
    await page.goto(productHref!, { waitUntil: "networkidle" });
    await expect(page.getByText("Mercatto", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Loja oficial")).toBeVisible();
  });

  test("carrinho aceita produto do Mercatto junto com produto de vendedor externo", async ({ page }) => {
    // Cadastra um produto do Mercatto primeiro (teste independente do
    // anterior — não assume que já existe nenhum produto oficial ativo).
    await login(page, "admin@mercatto.dev", "Senha123!");
    const mercattoProductName = `Produto Mercatto Carrinho ${Date.now()}`;
    await page.goto("/admin/produtos-mercatto/novo", { waitUntil: "networkidle" });
    await page.fill("#name", mercattoProductName);
    await page.fill("#description", "Produto oficial pro teste de carrinho misto.");
    await page.selectOption("#categoryId", { index: 1 });
    await page.fill("#sku", `E2E-MERCATTO-CART-${Date.now()}`);
    await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);
    await page.waitForTimeout(1200);
    await page.fill("#price", "79.90");
    await page.fill("#stock", "15");
    await submitAndWait(page, 'button:has-text("Cadastrar produto")');

    // Vendedor externo cria seu próprio produto.
    const sellerEmail = uniqueEmail("mercattocart-seller");
    await registerUser(page, { name: "Vendedor Externo", email: sellerEmail, password: DEFAULT_PASSWORD });
    await page.goto("/vendedor", { waitUntil: "networkidle" });
    await page.fill("#storeName", "Loja Externa Carrinho Misto");
    await submitAndWait(page, 'button:has-text("Criar minha loja")');

    const externalProductName = `Produto Externo Carrinho ${Date.now()}`;
    await page.goto("/vendedor/produtos/novo", { waitUntil: "networkidle" });
    await page.fill("#name", externalProductName);
    await page.fill("#description", "Produto de vendedor externo pro teste de carrinho misto.");
    await page.selectOption("#categoryId", { index: 1 });
    await page.fill("#sku", `E2E-EXTERNAL-${Date.now()}`);
    await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);
    await page.waitForTimeout(1200);
    await page.fill("#price", "49.90");
    await page.fill("#stock", "10");
    await submitAndWait(page, 'button:has-text("Cadastrar produto")');

    // Esse comprador agora precisa ver tanto o produto externo quanto um
    // produto já existente do Mercatto — adiciona os dois ao carrinho.
    const buyerEmail = uniqueEmail("mercattocart-buyer");
    await registerUser(page, { name: "Comprador Misto", email: buyerEmail, password: DEFAULT_PASSWORD });

    await page.goto(`/search?q=${encodeURIComponent(externalProductName)}`, { waitUntil: "networkidle" });
    const externalHref = await page.locator("a[href^='/produto/']").first().getAttribute("href");
    await page.goto(externalHref!, { waitUntil: "networkidle" });
    await page.click('button:has-text("Adicionar ao carrinho")');
    await page.waitForTimeout(800);

    await page.goto(`/search?q=${encodeURIComponent(mercattoProductName)}`, { waitUntil: "networkidle" });
    const mercattoHref = await page.locator("a[href^='/produto/']").first().getAttribute("href");
    await page.goto(mercattoHref!, { waitUntil: "networkidle" });
    await page.click('button:has-text("Adicionar ao carrinho")');
    await page.waitForTimeout(800);

    await page.goto("/carrinho", { waitUntil: "networkidle" });
    await expect(page.getByText(`Vendido por Loja Externa Carrinho Misto`)).toBeVisible();
    await expect(page.getByText(`Vendido por Mercatto`)).toBeVisible();
  });
});
