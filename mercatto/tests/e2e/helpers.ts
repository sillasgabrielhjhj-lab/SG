import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "Mercatto@2026";

export async function login(page: Page, email: string, redirect = "/") {
  await page.goto(`/entrar?redirect=${encodeURIComponent(redirect)}`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

/** Falha o teste se houver erro de JavaScript não tratado na página. */
export function trackPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return () => expect(errors, "erros de JavaScript na página").toEqual([]);
}
