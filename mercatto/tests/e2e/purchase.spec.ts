import { expect, test } from "@playwright/test";
import { login, trackPageErrors } from "./helpers";

/**
 * Fluxo principal de compra com o gateway de desenvolvimento:
 * busca → produto → carrinho → checkout (5 etapas) → PIX → aprovação simulada
 * (webhook assinado) → confirmação → pedido em "Minha conta".
 * Requer PAYMENT_PROVIDER=dev e seed DEMO.
 */
test("cliente compra um produto com PIX e acompanha o pedido", async ({ page }) => {
  const assertNoErrors = trackPageErrors(page);
  await login(page, "cliente@mercatto.dev");

  // Busca e produto
  await page.goto("/buscar?q=camiseta");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/produto/camiseta-basica-algodao");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Camiseta");

  // Limpa o carrinho para um total previsível
  await page.goto("/carrinho");
  for (let i = 0; i < 10; i++) {
    const remove = page.getByRole("button", { name: /^Remover/ }).first();
    if (!(await remove.isVisible().catch(() => false))) break;
    await remove.click();
    await page.waitForTimeout(600);
  }

  await page.goto("/produto/camiseta-basica-algodao");
  await page.getByRole("button", { name: "Comprar agora" }).click();
  await expect(page).toHaveURL(/\/carrinho/);
  await expect(page.getByText("Camiseta", { exact: false }).first()).toBeVisible();
  await page.getByRole("link", { name: "Continuar a compra" }).click();
  await expect(page).toHaveURL(/\/checkout/);

  // Etapas: Identificação → Endereço → Entrega → Pagamento → Revisão
  const next = page.getByRole("button", { name: "Continuar" });
  for (let step = 0; step < 4; step++) {
    await expect(next).toBeEnabled();
    await next.click();
    await page.waitForTimeout(800);
  }
  const finish = page.getByRole("button", { name: /Gerar PIX e finalizar/ });
  await expect(finish).toBeEnabled();
  await finish.click();

  // Pagamento PIX (sandbox) → aprovação simulada pelo mesmo caminho do webhook
  await expect(page).toHaveURL(/\/checkout\/pagamento\//, { timeout: 30_000 });
  await expect(page.getByText(/NAO-E-UM-PIX-VALIDO|Simulador do gateway/).first()).toBeVisible();
  await page.getByRole("button", { name: "Simular pagamento aprovado" }).click();
  await expect(page).toHaveURL(/\/checkout\/confirmacao\//, { timeout: 30_000 });

  // Pedido aparece na conta com pagamento aprovado
  await page.goto("/minha-conta/pedidos");
  const firstOrder = page.locator('a[href^="/minha-conta/pedidos/MRC-"]').first();
  await expect(firstOrder).toContainText("Pagamento aprovado");
  await firstOrder.click();
  await expect(page.getByRole("heading", { name: /Pedido MRC-/ })).toBeVisible();
  await expect(page.getByText("Pagamento simulado (ambiente de demonstração)")).toBeVisible();

  assertNoErrors();
});

test("áreas privadas exigem login e respeitam papéis", async ({ page }) => {
  await page.goto("/minha-conta");
  await expect(page).toHaveURL(/\/entrar\?redirect=/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/entrar/);

  await login(page, "cliente@mercatto.dev");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/acesso-negado/);
  await page.goto("/vendedor");
  await expect(page).toHaveURL(/\/vender/);
});

test("home e busca funcionam no celular @mobile", async ({ page }) => {
  const assertNoErrors = trackPageErrors(page);
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.goto("/buscar?q=fone");
  await expect(page.locator('a[href^="/produto/"]').first()).toBeVisible();
  assertNoErrors();
});
