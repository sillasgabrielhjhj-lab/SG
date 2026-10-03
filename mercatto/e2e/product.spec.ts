import { test, expect } from "@playwright/test";

import { registerUser, submitAndWait, uniqueEmail, DEFAULT_PASSWORD } from "./helpers";

async function firstProductSlug(page: import("@playwright/test").Page) {
  await page.goto("/categoria/eletronicos", { waitUntil: "networkidle" });
  const href = await page.locator("a[href^='/produto/']").first().getAttribute("href");
  if (!href) throw new Error("Nenhum produto encontrado para testar");
  return href;
}

test.describe("Página de produto", () => {
  test("mostra nome, preço, galeria e descrição", async ({ page }) => {
    const href = await firstProductSlug(page);
    await page.goto(href, { waitUntil: "networkidle" });

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("Descrição")).toBeVisible();
    await expect(page.getByText(/R\$\s*\d/).first()).toBeVisible();
  });

  test("mostra avaliações e seção de perguntas", async ({ page }) => {
    const href = await firstProductSlug(page);
    await page.goto(href, { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Avaliações" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Perguntas e respostas" })).toBeVisible();
  });

  test("calculadora de frete calcula com CEP válido", async ({ page }) => {
    const href = await firstProductSlug(page);
    await page.goto(href, { waitUntil: "networkidle" });

    await page.fill('input[aria-label="CEP"]', "50000-000");
    await page.click('button:has-text("Calcular")');
    await expect(page.getByText(/dias úteis/)).toBeVisible();
  });

  test("usuário não logado é levado ao login ao tentar adicionar ao carrinho", async ({ page }) => {
    const href = await firstProductSlug(page);
    await page.goto(href, { waitUntil: "networkidle" });

    await page.click('button:has-text("Adicionar ao carrinho")');
    await page.waitForURL(/\/entrar/);
    expect(page.url()).toContain("/entrar");
  });

  test("usuário logado consegue fazer uma pergunta sobre o produto", async ({ page }) => {
    const email = uniqueEmail("pergunta");
    await registerUser(page, { name: "Usuário Pergunta", email, password: DEFAULT_PASSWORD });

    const href = await firstProductSlug(page);
    await page.goto(href, { waitUntil: "networkidle" });

    await page.fill('textarea[name="question"]', "Esse produto tem garantia de quanto tempo?");
    await submitAndWait(page, 'button:has-text("Perguntar")');

    await expect(page.getByText("Pergunta enviada")).toBeVisible();
  });

  test("produto inexistente retorna 404", async ({ page }) => {
    const response = await page.goto("/produto/produto-que-nao-existe-xyz");
    expect(response?.status()).toBe(404);
  });
});
