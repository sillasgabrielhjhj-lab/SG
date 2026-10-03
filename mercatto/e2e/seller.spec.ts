import { test, expect } from "@playwright/test";
import path from "node:path";

import { registerUser, submitAndWait, uniqueEmail, DEFAULT_PASSWORD } from "./helpers";

const TEST_IMAGE = path.join(__dirname, "fixtures", "test-image.png");

async function becomeSeller(page: import("@playwright/test").Page, storeName: string) {
  await page.goto("/vendedor", { waitUntil: "networkidle" });
  await page.fill("#storeName", storeName);
  await submitAndWait(page, 'button:has-text("Criar minha loja")');
}

test.describe("Área do vendedor", () => {
  test("usuário cria loja e vê o painel", async ({ page }) => {
    const email = uniqueEmail("novaloja");
    await registerUser(page, { name: "Dono de Loja", email, password: DEFAULT_PASSWORD });
    await becomeSeller(page, "Minha Loja E2E");

    await expect(page.getByText("Minha Loja E2E", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  });

  test("cadastra um produto completo com imagem e ele aparece na loja", async ({ page }) => {
    const email = uniqueEmail("produtoloja");
    await registerUser(page, { name: "Vendedor Produto", email, password: DEFAULT_PASSWORD });
    await becomeSeller(page, "Loja com Produtos E2E");

    await page.goto("/vendedor/produtos/novo", { waitUntil: "networkidle" });
    await page.fill("#name", "Produto E2E Playwright");
    await page.fill("#description", "Produto cadastrado pelo teste automatizado de ponta a ponta.");
    await page.selectOption("#categoryId", { index: 1 });
    await page.fill("#sku", `E2E-SELLER-${Date.now()}`);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_IMAGE);
    await page.waitForTimeout(1200);

    await page.fill("#price", "149.90");
    await page.fill("#stock", "15");
    await submitAndWait(page, 'button:has-text("Cadastrar produto")');

    await expect(page.getByText("Produto E2E Playwright")).toBeVisible();
  });

  test("editar produto atualiza o preço", async ({ page }) => {
    const email = uniqueEmail("editarproduto");
    await registerUser(page, { name: "Vendedor Editor", email, password: DEFAULT_PASSWORD });
    await becomeSeller(page, "Loja Editora E2E");

    await page.goto("/vendedor/produtos/novo", { waitUntil: "networkidle" });
    await page.fill("#name", "Produto Para Editar");
    await page.fill("#description", "Produto que vai ser editado no teste.");
    await page.selectOption("#categoryId", { index: 1 });
    await page.fill("#sku", `E2E-EDIT-${Date.now()}`);
    await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);
    await page.waitForTimeout(1200);
    await page.fill("#price", "100.00");
    await page.fill("#stock", "5");
    await submitAndWait(page, 'button:has-text("Cadastrar produto")');

    await page.click('a[aria-label="Editar"]');
    await page.waitForLoadState("networkidle");
    await page.fill("#price", "200.00");
    await submitAndWait(page, 'button:has-text("Salvar alterações")');

    await expect(page.getByText("Produto atualizado")).toBeVisible();
  });

  test("produto sem nenhuma imagem é rejeitado", async ({ page }) => {
    const email = uniqueEmail("semimagem");
    await registerUser(page, { name: "Vendedor Sem Imagem", email, password: DEFAULT_PASSWORD });
    await becomeSeller(page, "Loja Sem Imagem E2E");

    await page.goto("/vendedor/produtos/novo", { waitUntil: "networkidle" });
    await page.fill("#name", "Produto Sem Imagem");
    await page.fill("#description", "Este produto não deveria ser salvo, falta imagem.");
    await page.selectOption("#categoryId", { index: 1 });
    await page.fill("#sku", `E2E-NOIMG-${Date.now()}`);
    await page.fill("#price", "50.00");
    await page.fill("#stock", "1");
    await submitAndWait(page, 'button:has-text("Cadastrar produto")');

    expect(page.url()).toContain("/vendedor/produtos/novo");
  });
});
