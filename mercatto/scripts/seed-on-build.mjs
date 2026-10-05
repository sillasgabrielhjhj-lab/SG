/**
 * Passos opcionais de dados durante o build (Vercel), controlados por variáveis:
 *
 * PURGE_DEMO_DATA=true  => início da operação real: cria/garante o administrador
 *   real (ADMIN_EMAIL/ADMIN_PASSWORD, seed "minimal") e remove TODOS os dados DEMO
 *   e compras de sandbox. Tem prioridade sobre SEED_ON_BUILD=demo.
 *
 * SEED_ON_BUILD:
 *   - ausente/vazio => não faz nada (padrão; produção real)
 *   - "demo"        => catálogo DEMO (exige DEMO_PASSWORD em produção)
 *   - "minimal"     => estrutura + administrador (exige ADMIN_EMAIL/ADMIN_PASSWORD)
 *
 * Tudo é idempotente: builds seguintes não duplicam nem apagam dados reais.
 */
import { execSync } from "node:child_process";

const truthy = (v) => /^(1|true|sim|yes)$/i.test((v ?? "").trim());
const run = (cmd, extraEnv = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...extraEnv } });

if (truthy(process.env.PURGE_DEMO_DATA)) {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.error("[dados] PURGE_DEMO_DATA exige ADMIN_EMAIL e ADMIN_PASSWORD (administrador real).");
    process.exit(1);
  }
  if ((process.env.SEED_ON_BUILD ?? "").trim()) console.warn("[dados] SEED_ON_BUILD ignorado: PURGE_DEMO_DATA está ativo.");
  console.log("[dados] Garantindo administrador real e estrutura (seed minimal)…");
  run("npx prisma db seed", { SEED_MODE: "minimal" });
  console.log("[dados] Removendo dados de demonstração…");
  run("npx tsx --conditions=react-server prisma/purge-demo.ts");
  process.exit(0);
}

const mode = (process.env.SEED_ON_BUILD ?? "").trim().toLowerCase();
if (!mode) {
  console.log("[dados] SEED_ON_BUILD não definido — seed ignorado.");
  process.exit(0);
}
if (mode !== "demo" && mode !== "minimal") {
  console.error(`[dados] Valor inválido para SEED_ON_BUILD: "${mode}". Use "demo" ou "minimal".`);
  process.exit(1);
}
console.log(`[dados] Executando seed no modo ${mode}…`);
run("npx prisma db seed", { SEED_MODE: mode, ...(mode === "demo" ? { SEED_ALLOW_DEMO_IN_PRODUCTION: "true" } : {}) });
