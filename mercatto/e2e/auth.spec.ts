import { test, expect } from "@playwright/test";

import { registerUser, login, submitAndWait, uniqueEmail, DEFAULT_PASSWORD } from "./helpers";

test.describe("Cadastro e login", () => {
  test("cadastro cria conta e autentica automaticamente", async ({ page }) => {
    const email = uniqueEmail("cadastro");
    await registerUser(page, { name: "Usuário E2E", email, password: DEFAULT_PASSWORD });

    expect(page.url()).toBe("http://localhost:3000/");

    await page.goto("/minha-conta");
    await expect(page.locator("h1")).toHaveText("Meus dados");
  });

  test("cadastro rejeita senha fraca", async ({ page }) => {
    await page.goto("/cadastro", { waitUntil: "networkidle" });
    await page.fill("#name", "Usuário Senha Fraca");
    await page.fill("#email", uniqueEmail("fraca"));
    await page.fill("#password", "123");
    await submitAndWait(page, 'button[type="submit"]');

    expect(page.url()).toContain("/cadastro");
  });

  test("não permite duas contas com o mesmo e-mail", async ({ page }) => {
    const email = uniqueEmail("duplicado");
    await registerUser(page, { name: "Primeira Conta", email, password: DEFAULT_PASSWORD });

    await page.goto("/", { waitUntil: "networkidle" });
    await page.goto("/cadastro", { waitUntil: "networkidle" });
    await page.fill("#name", "Segunda Conta");
    await page.fill("#email", email);
    await page.fill("#password", DEFAULT_PASSWORD);
    await submitAndWait(page, 'button[type="submit"]');

    await expect(page.getByText("Já existe uma conta com este e-mail")).toBeVisible();
  });

  test("login com senha incorreta mostra erro genérico", async ({ page }) => {
    const email = uniqueEmail("senhaerrada");
    await registerUser(page, { name: "Usuário Teste", email, password: DEFAULT_PASSWORD });

    await page.goto("/", { waitUntil: "networkidle" });
    const accountButton = page.locator("header button", { hasText: /./ }).first();
    await accountButton.click().catch(() => {});
    await page.goto("/entrar", { waitUntil: "networkidle" });
    await page.fill("#email", email);
    await page.fill("#password", "senhaTotalmenteErrada");
    await submitAndWait(page, 'button[type="submit"]');

    await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
  });

  test("login correto após cadastro funciona", async ({ page, context }) => {
    const email = uniqueEmail("loginok");
    await registerUser(page, { name: "Usuário Login", email, password: DEFAULT_PASSWORD });

    await context.clearCookies();
    await login(page, email, DEFAULT_PASSWORD);

    expect(page.url()).toBe("http://localhost:3000/");
  });

  test("rota protegida redireciona para login quando não autenticado", async ({ page }) => {
    await page.goto("/minha-conta");
    expect(page.url()).toContain("/entrar");
    expect(page.url()).toContain("next=%2Fminha-conta");
  });
});
