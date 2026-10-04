import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { env } from "@/server/env";

/**
 * Cliente Prisma único por processo (evita esgotar conexões no hot-reload).
 * Em serverless (Vercel), use a URL "pooled" do provedor (ex.: Neon -pooler).
 */
function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = typeof db;
/** Cliente transacional (dentro de db.$transaction). */
export type Tx = Prisma.TransactionClient;
