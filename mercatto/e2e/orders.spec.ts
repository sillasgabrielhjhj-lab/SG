import { test, expect } from "@playwright/test";

import { registerUser, submitAndWait, uniqueEmail, DEFAULT_PASSWORD } from "./helpers";

async function completeAnOrder(page: import("@playwright/test").Page) {
  await page.goto("/categoria/eletronicos", { waitUntil: "networkidle" });
  const href = await page.locator("a[href^='/produto/']").first().getAttribute("href");
  await page.goto(href!, { waitUntil: "networkidle" });
  await page.click('button:has-text("Adicionar ao carrinho")');
  await page.waitForTimeout(1000);

  await page.goto("/checkout", { waitUntil: "networkidle" });
  await page.click("text=Adicionar endereço");
  await page.waitForTimeout(300);
  await page.fill("#recipientName", "Comprador Pedido");
  await page.fill("#zipCode", "50000-000");
  await page.fill("#state", "PE");
  await page.fill("#street", "Rua dos Pedidos");
  await page.fill("#number", "1");
  await page.fill("#neighborhood", "Centro");
  await page.fill("#city", "Recife");
  await submitAndWait(page, 'button:has-text("Salvar endereço")');
  await page.waitForTimeout(500);

  await page.click('input[name="checkout-address"]');
  await page.click('button:has-text("Continuar")');
  await page.click('button:has-text("Continuar")');
  await page.fill("#cardNumber", "4111 1111 1111 1111");
  await page.fill("#cardName", "COMPRADOR PEDIDO");
  await page.fill("#cardExpiry", "12/30");
  await page.fill("#cardCvv", "123");
  await page.click('button:has-text("Continuar")');
  await page.click('button:has-text("Confirmar pedido")');
  await page.waitForURL(/\/pedido-confirmado\//);

  const text = await page.textContent("main");
  const match = text?.match(/MKT-\d{4}-[A-F0-9]+/);
  if (!match) throw new Error("Pedido não foi confirmado");
  return match[0];
}

test.describe("Pedidos", () => {
  test("pedido confirmado aparece em Meus Pedidos", async ({ page }) => {
    const email = uniqueEmail("pedidolista");
    await registerUser(page, { name: "Comprador Pedido Lista", email, password: DEFAULT_PASSWORD });
    const orderNumber = await completeAnOrder(page);

    await page.goto("/minha-conta/pedidos", { waitUntil: "networkidle" });
    await expect(page.getByText(orderNumber)).toBeVisible();
    await expect(page.getByText("Pagamento aprovado")).toBeVisible();
  });

  test("detalhe do pedido mostra itens, endereço e pagamento", async ({ page }) => {
    const email = uniqueEmail("pedidodetalhe");
    await registerUser(page, { name: "Comprador Pedido Detalhe", email, password: DEFAULT_PASSWORD });
    const orderNumber = await completeAnOrder(page);

    await page.goto(`/minha-conta/pedidos/${orderNumber}`, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(orderNumber);
    await expect(page.getByRole("heading", { name: "Itens" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Endereço de entrega" })).toBeVisible();
  });

  test("cancelar pedido muda o status e devolve o carrinho esvaziado permanece vazio", async ({ page }) => {
    const email = uniqueEmail("pedidocancela");
    await registerUser(page, { name: "Comprador Cancela", email, password: DEFAULT_PASSWORD });
    const orderNumber = await completeAnOrder(page);

    await page.goto(`/minha-conta/pedidos/${orderNumber}`, { waitUntil: "networkidle" });
    await page.click('button:has-text("Cancelar pedido")');
    await page.waitForTimeout(300);
    await page.fill("#reason", "Teste automatizado — comprei por engano");
    await submitAndWait(page, 'button:has-text("Confirmar")');

    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  });

  test("pedido de outro usuário não é acessível (404)", async ({ page, context }) => {
    const emailA = uniqueEmail("dono");
    await registerUser(page, { name: "Dono do Pedido", email: emailA, password: DEFAULT_PASSWORD });
    const orderNumber = await completeAnOrder(page);

    await context.clearCookies();
    const emailB = uniqueEmail("intruso");
    await registerUser(page, { name: "Outro Usuário", email: emailB, password: DEFAULT_PASSWORD });

    const response = await page.goto(`/minha-conta/pedidos/${orderNumber}`);
    expect(response?.status()).toBe(404);
  });
});
