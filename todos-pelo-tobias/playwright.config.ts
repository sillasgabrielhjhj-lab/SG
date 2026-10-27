import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Dados FICTÍCIOS usados só nos testes (nunca vão para o site publicado).
const testEnv = {
  NEXT_PUBLIC_PIX_RECEIVER_NAME: "NOME TESTE",
  NEXT_PUBLIC_PIX_RECEIVER_CITY: "CIDADE TESTE",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 240_000,
    env: testEnv,
  },
  // Emulação no Chromium (viewport, toque e user agent). Não substitui o teste em aparelhos reais.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "iphone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
