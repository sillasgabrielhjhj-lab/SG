import { test, expect } from "@playwright/test";

import { registerUser, login, uniqueEmail, DEFAULT_PASSWORD } from "./helpers";

test.describe("Permissões (RBAC)", () => {
  test("usuário comum não acessa o painel administrativo", async ({ page }) => {
    const email = uniqueEmail("rbacuser");
    await registerUser(page, { name: "Usuário Comum", email, password: DEFAULT_PASSWORD });

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/admin");
  });

  test("usuário comum sem loja vê a tela de cadastro de vendedor, não o painel", async ({ page }) => {
    const email = uniqueEmail("rbacseller");
    await registerUser(page, { name: "Usuário Sem Loja", email, password: DEFAULT_PASSWORD });

    await page.goto("/vendedor", { waitUntil: "networkidle" });
    await expect(page.getByText("Comece a vender na Mercatto")).toBeVisible();
    await expect(page.getByText("Visão geral")).not.toBeVisible();
  });

  test("vendedor (sem ser admin) não acessa o painel administrativo", async ({ page }) => {
    const email = uniqueEmail("rbacsellernotadmin");
    await registerUser(page, { name: "Vendedor Sem Admin", email, password: DEFAULT_PASSWORD });

    await page.goto("/vendedor", { waitUntil: "networkidle" });
    await page.fill("#storeName", "Loja RBAC Teste");
    await Promise.all([
      page.waitForResponse((res) => res.request().method() === "POST"),
      page.click('button:has-text("Criar minha loja")'),
    ]);
    await page.waitForTimeout(500);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/admin");
  });

  test("admin acessa normalmente o painel administrativo", async ({ page }) => {
    await login(page, "admin@mercatto.dev", "Senha123!");
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  });

  test("vendedor (sem ser admin) não acessa Produtos do Mercatto, mesmo sabendo a URL", async ({ page }) => {
    const email = uniqueEmail("rbacmercattoproducts");
    await registerUser(page, { name: "Vendedor Curioso", email, password: DEFAULT_PASSWORD });

    await page.goto("/vendedor", { waitUntil: "networkidle" });
    await page.fill("#storeName", "Loja Curiosa RBAC");
    await Promise.all([
      page.waitForResponse((res) => res.request().method() === "POST"),
      page.click('button:has-text("Criar minha loja")'),
    ]);
    await page.waitForTimeout(500);

    await page.goto("/admin/produtos-mercatto");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/admin/produtos-mercatto");
  });

  test("admin acessa e cadastra um produto em Produtos do Mercatto", async ({ page }) => {
    await login(page, "admin@mercatto.dev", "Senha123!");
    await page.goto("/admin/produtos-mercatto", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Produtos do Mercatto" })).toBeVisible();
  });

  test("não autenticado é bloqueado em todas as áreas restritas", async ({ page }) => {
    for (const path of ["/minha-conta", "/vendedor", "/admin", "/checkout"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain("/entrar");
    }
  });
});
