/**
 * Seed opcional durante o build (útil para prévias na Vercel sem rodar nada
 * localmente). Controlado por SEED_ON_BUILD:
 *   - ausente/vazio => não faz nada (padrão; produção real)
 *   - "demo"        => catálogo DEMO (dados fictícios identificados como DEMO)
 *   - "minimal"     => estrutura + administrador (exige ADMIN_EMAIL/ADMIN_PASSWORD)
 * O seed é idempotente: builds seguintes não duplicam dados.
 */
import { execSync } from "node:child_process";

const mode = (process.env.SEED_ON_BUILD ?? "").trim().toLowerCase();
if (!mode) {
  console.log("[seed-on-build] SEED_ON_BUILD não definido — seed ignorado.");
  process.exit(0);
}
if (mode !== "demo" && mode !== "minimal") {
  console.error(`[seed-on-build] Valor inválido para SEED_ON_BUILD: "${mode}". Use "demo" ou "minimal".`);
  process.exit(1);
}
console.log(`[seed-on-build] Executando seed no modo ${mode}…`);
execSync("npx prisma db seed", {
  stdio: "inherit",
  env: { ...process.env, SEED_MODE: mode, ...(mode === "demo" ? { SEED_ALLOW_DEMO_IN_PRODUCTION: "true" } : {}) },
});
