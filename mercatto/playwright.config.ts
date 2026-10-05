import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra uma instância já em execução (padrão http://localhost:3000) com o
 * seed DEMO aplicado. NUNCA aponte para produção: os testes criam pedidos.
 * - E2E_BASE_URL: URL alvo.
 * - E2E_START_SERVER=1: sobe "npm run dev" automaticamente.
 * - PLAYWRIGHT_CHROMIUM_PATH: executável do Chromium (ambientes sem download).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH === "/opt/pw-browsers" ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_START_SERVER === "1" ? { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 180_000 } : undefined,
});
