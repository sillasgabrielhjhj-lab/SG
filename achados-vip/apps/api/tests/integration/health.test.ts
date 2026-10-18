import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/app.js';
import { closeTestResources } from '../helpers/db.js';
import { redis } from '../../src/lib/redis.js';

describe('health / ready', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
    await closeTestResources();
  });

  it('GET /health é público e responde ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('GET /ready verifica banco e Redis reais', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready', checks: { db: 'ok', redis: 'ok' } });
  });

  it('GET /ready devolve 503 (sem detalhes internos) quando o Redis falha', async () => {
    const spy = vi.spyOn(redis, 'ping').mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5:6379 senha=segredo'));
    const res = await app.inject({ method: 'GET', url: '/ready' });
    spy.mockRestore();
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'not_ready', checks: { db: 'ok', redis: 'error' } });
    expect(res.body).not.toContain('segredo');
  });
});
