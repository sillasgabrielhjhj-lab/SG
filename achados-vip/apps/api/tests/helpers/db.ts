/**
 * Helpers de banco para testes de integração (Postgres/Redis REAIS de teste).
 *
 * Uso típico (qualquer módulo):
 *   import { resetDb, createTestAdmin, closeTestResources } from '../helpers/db.js';
 *   beforeEach(async () => { await resetDb(); });          // TRUNCATE de tudo (menos _prisma_migrations)
 *   afterAll(async () => { await closeTestResources(); });  // fecha Prisma/Redis do arquivo de teste
 *
 * - resetDb() recusa rodar fora de NODE_ENV=test ou se o banco não tiver "test" no nome (proteção contra apagar dados reais).
 * - createTestAdmin() cria um usuário ADMIN (senha com hash argon2 real) e devolve as credenciais em texto puro.
 * - resetRedis() limpa o Redis de teste (somente o DB lógico /15).
 */
import { prisma, disconnectDb } from '../../src/lib/db.js';
import { env } from '../../src/lib/env.js';
import { redis, closeRedis } from '../../src/lib/redis.js';
import { hashPassword, normalizeEmail } from '../../src/services/auth.js';
import { clearSettingsCache } from '../../src/services/settings.js';
import type { UserRole } from '@prisma/client';

export const TEST_ADMIN_EMAIL = 'admin@teste.local';
export const TEST_ADMIN_PASSWORD = 'Senha-De-Teste-123!';

function assertTestDatabase(): void {
  const dbName = new URL(env.DATABASE_URL).pathname.replace(/^\//, '');
  if (!env.isTest || !/test/i.test(dbName)) {
    throw new Error(`resetDb recusado: NODE_ENV=${env.NODE_ENV}, banco="${dbName}". Use somente o banco de teste (ex.: achados_test).`);
  }
}

/** Apaga todos os dados de todas as tabelas (CASCADE), exceto _prisma_migrations. */
export async function resetDb(): Promise<void> {
  assertTestDatabase();
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  clearSettingsCache();
}

/** Limpa o Redis de teste (DB lógico 15). */
export async function resetRedis(): Promise<void> {
  if (!env.isTest || new URL(env.REDIS_URL).pathname !== '/15') {
    throw new Error('resetRedis recusado: use somente o Redis de teste (redis://.../15).');
  }
  await redis.flushdb();
}

export interface TestAdmin {
  id: string;
  email: string;
  password: string;
  role: UserRole;
}

export async function createTestAdmin(opts: { email?: string; password?: string; role?: UserRole } = {}): Promise<TestAdmin> {
  const email = normalizeEmail(opts.email ?? TEST_ADMIN_EMAIL);
  const password = opts.password ?? TEST_ADMIN_PASSWORD;
  const role = opts.role ?? 'ADMIN';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, failedLogins: 0, lockedUntil: null },
    create: { email, passwordHash, role },
  });
  return { id: user.id, email, password, role };
}

/** Fecha as conexões Prisma e Redis deste arquivo de teste. */
export async function closeTestResources(): Promise<void> {
  await Promise.allSettled([disconnectDb(), closeRedis()]);
}
