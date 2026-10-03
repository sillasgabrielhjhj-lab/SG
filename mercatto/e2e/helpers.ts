import type { Page } from "@playwright/test";

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.mercatto.dev`;
}

export async function submitAndWait(page: Page, selector: string) {
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === "POST"),
    page.click(selector),
  ]);
  await page.waitForTimeout(500);
}

export async function registerUser(page: Page, { name, email, password }: { name: string; email: string; password: string }) {
  await page.goto("/cadastro", { waitUntil: "networkidle" });
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await submitAndWait(page, 'button[type="submit"]');
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/entrar", { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await submitAndWait(page, 'button[type="submit"]');
}

export const DEFAULT_PASSWORD = "SenhaForte123";
