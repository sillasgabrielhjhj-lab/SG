import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, closeTestResources, createTestAdmin, resetDb } from '../helpers/db.js';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});
afterAll(async () => {
  await closeTestResources();
});
beforeAll(async () => {
  await resetDb();
  await createTestAdmin();
});

const loginFrom = (app: FastifyInstance, ip: string, password = 'senha-errada-qualquer') =>
  app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: ip, payload: { email: 'ninguem@exemplo.com', password } });

describe('rate limit', () => {
  it('login: após o limite estrito do IP responde 429 RATE_LIMITED com Retry-After', async () => {
    const app = await buildTestApp({ rateLimit: { login: { max: 5, timeWindow: '1 minute' } } });
    apps.push(app);
    for (let i = 0; i < 5; i++) expect((await loginFrom(app, '10.1.1.1')).statusCode).toBe(401);
    const blocked = await loginFrom(app, '10.1.1.1');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
    expect(blocked.json().error.message).toMatch(/Muitas requisições/);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // mesmo com a senha CORRETA, o IP limitado não passa
    const correct = await app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: '10.1.1.1', payload: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD } });
    expect(correct.statusCode).toBe(429);
  });

  it('o limite é por IP: outro IP não é afetado', async () => {
    const app = await buildTestApp({ rateLimit: { login: { max: 2, timeWindow: '1 minute' } } });
    apps.push(app);
    await loginFrom(app, '10.2.2.2');
    await loginFrom(app, '10.2.2.2');
    expect((await loginFrom(app, '10.2.2.2')).statusCode).toBe(429);
    expect((await loginFrom(app, '10.3.3.3')).statusCode).toBe(401);
  });

  it('requisições comuns não consomem a cota do login', async () => {
    const app = await buildTestApp({ rateLimit: { login: { max: 3, timeWindow: '1 minute' } } });
    apps.push(app);
    for (let i = 0; i < 10; i++) expect((await app.inject({ method: 'GET', url: '/api/auth/me', remoteAddress: '10.4.4.4' })).statusCode).toBe(401);
    for (let i = 0; i < 3; i++) expect((await loginFrom(app, '10.4.4.4')).statusCode).toBe(401);
    expect((await loginFrom(app, '10.4.4.4')).statusCode).toBe(429);
  });

  it('limite global protege /api/* mas não /health nem /ready', async () => {
    const app = await buildTestApp({ rateLimit: { global: { max: 3, timeWindow: '1 minute' } } });
    apps.push(app);
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await app.inject({ method: 'GET', url: '/api/settings', remoteAddress: '10.5.5.5' })).statusCode);
    expect(statuses).toEqual([401, 401, 401, 429, 429]);
    for (let i = 0; i < 6; i++) expect((await app.inject({ method: 'GET', url: '/health', remoteAddress: '10.5.5.5' })).statusCode).toBe(200);
  });
});
