import { test, expect } from "@playwright/test";

import { registerUser, submitAndWait, uniqueEmail, DEFAULT_PASSWORD } from "./helpers";

async function addFirstProductToCart(page: import("@playwright/test").Page) {
  await page.goto("/categoria/eletronicos", { waitUntil: "networkidle" });
  const href = await page.locator("a[href^='/produto/']").first().getAttribute("href");
  await page.goto(href!, { waitUntil: "networkidle" });
  const productName = (await page.locator("h1").textContent())?.trim();
  await page.click('button:has-text("Adicionar ao carrinho")');
  await page.waitForTimeout(1000);
  return productName;
}

async function fillNewAddress(page: import("@playwright/test").Page) {
  await page.click("text=Adicionar endereço");
  await page.waitForTimeout(300);
  await page.fill("#recipientName", "Comprador E2E");
  await page.fill("#zipCode", "50000-000");
  await page.fill("#state", "PE");
  await page.fill("#street", "Rua do Teste E2E");
  await page.fill("#number", "100");
  await page.fill("#neighborhood", "Centro");
  await page.fill("#city", "Recife");
  await submitAndWait(page, 'button:has-text("Salvar endereço")');
  await page.waitForTimeout(500);
}

test.describe("Carrinho e checkout", () => {
  test("adicionar produto ao carrinho e ver na página do carrinho", async ({ page }) => {
    const email = uniqueEmail("carrinho");
    await registerUser(page, { name: "Comprador Carrinho", email, password: DEFAULT_PASSWORD });

    const productName = await addFirstProductToCart(page);

    await page.goto("/carrinho", { waitUntil: "networkidle" });
    await expect(page.getByText(productName!)).toBeVisible();
  });

  test("alterar quantidade atualiza o subtotal", async ({ page }) => {
    const email = uniqueEmail("qtd");
    await registerUser(page, { name: "Comprador Quantidade", email, password: DEFAULT_PASSWORD });
    await addFirstProductToCart(page);

    await page.goto("/carrinho", { waitUntil: "networkidle" });
    const subtotalBefore = await page.getByText(/Subtotal/).textContent();

    await page.click('button[aria-label="Aumentar quantidade"]');
    await page.waitForTimeout(800);

    const subtotalAfter = await page.getByText(/Subtotal/).textContent();
    expect(subtotalAfter).not.toBe(subtotalBefore);
  });

  test("remover item esvazia o carrinho", async ({ page }) => {
    const email = uniqueEmail("remover");
    await registerUser(page, { name: "Comprador Remove", email, password: DEFAULT_PASSWORD });
    await addFirstProductToCart(page);

    await page.goto("/carrinho", { waitUntil: "networkidle" });
    await page.click("text=Remover");
    await page.waitForTimeout(800);

    await expect(page.getByText("Seu carrinho está vazio")).toBeVisible();
  });

  test("checkout completo: endereço → entrega → pagamento → revisão → confirmação", async ({ page }) => {
    const email = uniqueEmail("checkout");
    await registerUser(page, { name: "Comprador Checkout", email, password: DEFAULT_PASSWORD });
    await addFirstProductToCart(page);

    await page.goto("/checkout", { waitUntil: "networkidle" });
    await fillNewAddress(page);

    await page.click('input[name="checkout-address"]');
    await page.click('button:has-text("Continuar")');
    await expect(page.getByRole("heading", { name: "Como você quer receber?" })).toBeVisible();

    await page.click('button:has-text("Continuar")');
    await expect(page.getByRole("heading", { name: "Como você quer pagar?" })).toBeVisible();

    await page.fill("#cardNumber", "4111 1111 1111 1111");
    await page.fill("#cardName", "COMPRADOR TESTE");
    await page.fill("#cardExpiry", "12/30");
    await page.fill("#cardCvv", "123");
    await page.click('button:has-text("Continuar")');
    await expect(page.getByRole("heading", { name: "Revise seu pedido" })).toBeVisible();

    await page.click('button:has-text("Confirmar pedido")');
    await page.waitForURL(/\/pedido-confirmado\//);

    await expect(page.getByText("Pedido confirmado!")).toBeVisible();
    await expect(page.getByText(/MKT-\d{4}-[A-F0-9]+/)).toBeVisible();
  });

  test("checkout não avança sem endereço selecionado", async ({ page }) => {
    const email = uniqueEmail("semendereco");
    await registerUser(page, { name: "Sem Endereço", email, password: DEFAULT_PASSWORD });
    await addFirstProductToCart(page);

    await page.goto("/checkout", { waitUntil: "networkidle" });
    const continueButton = page.getByRole("button", { name: "Continuar" });
    await expect(continueButton).toBeDisabled();
  });

  test("carrinho vazio redireciona para fora do checkout", async ({ page }) => {
    const email = uniqueEmail("vazio");
    await registerUser(page, { name: "Carrinho Vazio", email, password: DEFAULT_PASSWORD });

    await page.goto("/checkout");
    await page.waitForURL(/\/carrinho/);
    expect(page.url()).toContain("/carrinho");
  });

  test("cupom inválido mostra mensagem de erro", async ({ page }) => {
    const email = uniqueEmail("cupominvalido");
    await registerUser(page, { name: "Cupom Inválido", email, password: DEFAULT_PASSWORD });
    await addFirstProductToCart(page);

    await page.goto("/carrinho", { waitUntil: "networkidle" });
    await page.fill('input[name="code"]', "CUPOMFALSONAOEXISTE");
    await submitAndWait(page, 'button:has-text("Aplicar")');

    await expect(page.getByText("Cupom inválido ou expirado")).toBeVisible();
  });
});
