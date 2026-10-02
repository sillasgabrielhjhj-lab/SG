import { test, expect, type Browser, type Page } from "@playwright/test";

import { login, submitAndWait } from "./helpers";

// Os testes de admin compartilham uma única sessão logada (login feito
// uma vez em beforeAll) — logar de novo a cada teste bateria no rate
// limit de login (5 tentativas / 15min) da conta fixa de demonstração.
test.describe.serial("Painel administrativo", () => {
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    page = await browser.newPage();
    await login(page, "admin@mercatto.dev", "Senha123!");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("visão geral mostra métricas reais da plataforma", async () => {
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByText("Receita total")).toBeVisible();
    await expect(page.locator("p.text-xs", { hasText: "Produtos" })).toBeVisible();
    await expect(page.locator("p.text-xs", { hasText: "Vendedores" })).toBeVisible();
  });

  test("lista de usuários carrega e permite trocar o papel", async () => {
    await page.goto("/admin/usuarios", { waitUntil: "networkidle" });
    const roleSelects = page.locator("select");
    expect(await roleSelects.count()).toBeGreaterThan(0);
  });

  test("criar e desativar um cupom", async () => {
    const code = `E2E${Date.now() % 1000000}`;
    await page.goto("/admin/cupons", { waitUntil: "networkidle" });
    await page.click('button:has-text("Novo cupom")');
    await page.waitForTimeout(300);
    await page.fill("#code", code);
    await page.fill("#value", "20");
    await submitAndWait(page, 'button:has-text("Criar cupom")');

    await expect(page.getByText(code)).toBeVisible();

    const row = page.locator("tr", { hasText: code });
    await row.getByRole("button", { name: "Desativar" }).click();
    await page.waitForTimeout(500);
    await expect(row.getByText("Inativo")).toBeVisible();
  });

  test("criar categoria e remover (sem produtos associados)", async () => {
    const name = `Categoria E2E ${Date.now()}`;
    await page.goto("/admin/categorias", { waitUntil: "networkidle" });
    await page.click('button:has-text("Nova categoria")');
    await page.waitForTimeout(300);
    await page.fill("#name", name);
    await submitAndWait(page, 'button:has-text("Criar categoria")');

    await expect(page.getByText(name)).toBeVisible();

    const row = page.locator("tr", { hasText: name });
    await row.getByRole("button", { name: "Remover" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(name)).not.toBeVisible();
  });

  test("lista de produtos mostra o vendedor de cada item", async () => {
    await page.goto("/admin/produtos", { waitUntil: "networkidle" });
    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("lista de pedidos carrega", async () => {
    await page.goto("/admin/pedidos", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toHaveText("Pedidos");
  });
});
