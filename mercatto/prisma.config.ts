import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // CLI (migrate/seed) usa a conexão DIRETA quando existir (Neon/Supabase:
    // a URL com pooling não é adequada para migrations). O app usa DATABASE_URL.
    // Fallbacks automáticos para as variáveis criadas pelas integrações da Vercel
    // (Neon: DATABASE_URL_UNPOOLED; Postgres/Supabase: POSTGRES_URL_NON_POOLING).
    url: process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || env("DATABASE_URL"),
  },
});
