import type { FastifyInstance } from 'fastify';
import { checkDb } from '../lib/db.js';
import { pingRedis } from '../lib/redis.js';

export default async function (app: FastifyInstance) {
  // liveness: o processo está de pé (não toca em dependências)
  app.get('/health', { schema: { tags: ['health'], summary: 'Liveness' } }, async () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  }));

  // readiness: banco e Redis respondem (503 caso contrário; sem detalhes internos)
  app.get('/ready', { schema: { tags: ['health'], summary: 'Readiness (PostgreSQL + Redis)' } }, async (_request, reply) => {
    const [db, redis] = await Promise.all([checkDb(), pingRedis()]);
    const ready = db && redis;
    return reply.code(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'not_ready',
      checks: { db: db ? 'ok' : 'error', redis: redis ? 'ok' : 'error' },
    });
  });
}
