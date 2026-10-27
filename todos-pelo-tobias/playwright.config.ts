import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Os testes rodam no modo "só chave Pix" (sem nome/cidade do recebedor), o padrão do site.
const testEnv = {
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
