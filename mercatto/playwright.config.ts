import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Alguns ambientes (como este sandbox de desenvolvimento) já vêm com um
// Chromium pré-instalado em revisão própria, que pode não bater com a
// revisão que o pacote @playwright/test espera. Nesse caso, usamos o
// binário já existente em vez de tentar baixar um novo; em qualquer
// outra máquina (CI, seu computador), isso é ignorado e o Playwright usa
// o navegador instalado normalmente via `npx playwright install`.
const sandboxChromiumPath = "/opt/pw-browsers/chromium";
const executablePath = existsSync(sandboxChromiumPath) ? sandboxChromiumPath : undefined;

/**
 * Testes E2E rodam contra o servidor de desenvolvimento (banco mercatto,
 * com os dados do seed). Cada teste que grava dados cria sua própria
 * conta com e-mail aleatório, então não interfere nos dados de
 * demonstração nem em outros testes.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
