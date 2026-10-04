import { execSync } from "node:child_process";
import "dotenv/config";

/**
 * Prepara o banco de TESTE (TEST_DATABASE_URL) aplicando as migrations do zero.
 * Nunca roda contra DATABASE_URL de desenvolvimento/produção.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Defina TEST_DATABASE_URL para rodar os testes de integração.");
  if (!/test/i.test(url)) throw new Error("TEST_DATABASE_URL deve apontar para um banco de testes (nome contendo 'test').");
  execSync("npx prisma migrate reset --force", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}
