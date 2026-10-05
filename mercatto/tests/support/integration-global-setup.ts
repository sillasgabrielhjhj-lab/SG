import { execSync } from "node:child_process";
import "dotenv/config";

/**
 * Prepara o banco de TESTE (TEST_DATABASE_URL) aplicando migrations pendentes
 * (`prisma migrate deploy` — não destrutivo). Os testes criam dados com
 * identificadores únicos, sem depender de um banco vazio. Para zerar o banco
 * de testes manualmente: DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate reset.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Defina TEST_DATABASE_URL para rodar os testes de integração.");
  if (!/test/i.test(url)) throw new Error("TEST_DATABASE_URL deve apontar para um banco de testes (nome contendo 'test').");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}
