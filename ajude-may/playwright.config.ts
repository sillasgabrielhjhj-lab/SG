import { defineConfig, devices } from "@playwright/test";

/**
 * Dois sites são construídos para os testes:
 * - "configurado": chave Pix FICTÍCIA de teste e meta de teste (valores só para o teste);
 * - "padrão": exatamente como o projeto está hoje (sem chave, sem meta, sem fotos).
 */
const CONFIGURED = 3200;
const DEFAULT = 3201;

const server = (port: number, distDir: string, env: Record<string, string> = {}) => ({
  command: `npm run build && npm run start -- -p ${port}`,
  url: `http://localhost:${port}`,
  reuseExistingServer: true,
  timeout: 300_000,
  env: { NEXT_DIST_DIR: distDir, NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`, ...env },
});

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { permissions: ["clipboard-read", "clipboard-write"], trace: "retain-on-failure" },
  webServer: [
    server(CONFIGURED, ".next-e2e-configurado", {
      PIX_KEY: "chave-teste@example.com",
      PIX_RECEIVER_NAME: "Responsavel Teste",
      PIX_RECEIVER_CITY: "Sao Paulo",
      FUNDRAISING_GOAL: "20000",
      FUNDRAISING_RAISED: "7500",
    }),
    server(DEFAULT, ".next-e2e-padrao"),
  ],
  // Emulação no Chromium (viewport, toque e user agent). Não substitui aparelhos reais.
  projects: [
    {
      name: "desktop",
      testMatch: "campanha.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${CONFIGURED}` },
    },
    {
      name: "celular",
      testMatch: "campanha.spec.ts",
      use: { ...devices["Pixel 7"], baseURL: `http://localhost:${CONFIGURED}` },
    },
    {
      name: "padrao",
      testMatch: "padrao.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEFAULT}` },
    },
  ],
});
