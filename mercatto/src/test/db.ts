import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

/** Cliente Prisma dedicado aos testes — sempre aponta para mercatto_test
 * (verificado em src/test/setup.ts), nunca para o banco de dev/produção. */
export const testPrisma = new PrismaClient({ adapter });
