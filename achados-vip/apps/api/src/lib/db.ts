import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { withTimeout } from './time.js';

/** Singleton do Prisma (reaproveitado em hot-reload do `tsx watch`). Use `prisma` (ou o alias `db`). */
const globalForPrisma = globalThis as unknown as { __achadosPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__achadosPrisma ??
  new PrismaClient({
    datasourceUrl: env.DATABASE_URL,
    log: ['warn', 'error'],
  });

if (!env.isProduction) globalForPrisma.__achadosPrisma = prisma;

export const db = prisma;

/** Verifica conectividade com o banco (usado por /ready). Nunca lança. */
export async function checkDb(timeoutMs = 2000): Promise<boolean> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs, 'db');
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  if (globalForPrisma.__achadosPrisma === prisma) delete globalForPrisma.__achadosPrisma;
}

