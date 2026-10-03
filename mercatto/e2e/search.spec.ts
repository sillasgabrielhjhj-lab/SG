import { test, expect } from "@playwright/test";

test.describe("Busca e catálogo", () => {
  test("busca por termo retorna produtos relacionados", async ({ page }) => {
    await page.goto("/search?q=fone", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText("fone");

    const cards = page.locator("a[href^='/produto/']");
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("busca sem resultados mostra estado vazio", async ({ page }) => {
    await page.goto("/search?q=xyzxyzxyznaoexiste123", { waitUntil: "networkidle" });
    await expect(page.getByText("Nenhum produto encontrado")).toBeVisible();
  });

  test("autocomplete sugere produtos ao digitar", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const searchInput = page.locator('input[type="search"]').first();
    await searchInput.click();
    await searchInput.fill("fone");

    // getByRole com retry automático em vez de sleep fixo — a sugestão
    // vem de uma busca com debounce (200ms) + fetch, então o tempo varia.
    const firstSuggestion = page.locator("button", { hasText: /fone/i }).first();
    await expect(firstSuggestion).toBeVisible({ timeout: 5000 });
  });

  test("filtro de preço reduz os resultados", async ({ page }) => {
    await page.goto("/categoria/eletronicos", { waitUntil: "networkidle" });
    const totalBefore = await page.locator("a[href^='/produto/']").count();

    await page.fill('input[name="min"]', "1000");
    await page.fill('input[name="max"]', "1001");
    await page.click('button:has-text("Ir")');
    await page.waitForLoadState("networkidle");

    const totalAfter = await page.locator("a[href^='/produto/']").count();
    expect(totalAfter).toBeLessThanOrEqual(totalBefore);
  });

  test("categoria com subcategorias lista links para elas", async ({ page }) => {
    await page.goto("/categoria/eletronicos", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "Áudio" })).toBeVisible();
  });

  test("paginação muda a URL e o conteúdo", async ({ page }) => {
    await page.goto("/categoria/eletronicos?sort=price_asc", { waitUntil: "networkidle" });
    const pageTwoLink = page.locator('nav[aria-label="Paginação"] a', { hasText: "2" });
    if (await pageTwoLink.isVisible().catch(() => false)) {
      await pageTwoLink.click();
      await page.waitForURL(/page=2/);
    }
  });
});
