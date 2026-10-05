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
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
