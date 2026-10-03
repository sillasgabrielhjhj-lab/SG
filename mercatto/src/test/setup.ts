// Carregado antes de cada arquivo de teste (ver vitest.config.ts).
// As variáveis de ambiente de teste (banco separado, nunca o de
// dev/produção) já são injetadas pelo loadEnv no config.
if (!process.env.DATABASE_URL?.includes("mercatto_test")) {
  throw new Error(
    "Testes precisam rodar contra o banco mercatto_test — DATABASE_URL não aponta para ele. " +
      "Verifique .env.test.",
  );
}
