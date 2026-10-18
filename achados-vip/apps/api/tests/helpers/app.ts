/**
 * Helpers de aplicação para testes de integração.
 *
 * Uso típico:
 *   import { buildTestApp, loginAgent } from '../helpers/app.js';
 *   import { resetDb, createTestAdmin, closeTestResources } from '../helpers/db.js';
 *
 *   let app: FastifyInstance;
 *   beforeAll(async () => { app = await buildTestApp(); });
 *   afterAll(async () => { await app.close(); await closeTestResources(); });
 *   beforeEach(async () => { await resetDb(); await createTestAdmin(); });
 *
 *   it('lista algo', async () => {
 *     const agent = await loginAgent(app);          // faz login real (cookie + CSRF)
 *     const res = await agent.get('/api/categories');
 *     expect(res.statusCode).toBe(200);
 *     const put = await agent.put('/api/settings', { publishing: { autoPublish: false } }); // CSRF automático
 *   });
 *
 * - buildTestApp(): buildApp() sem logs e com rate limit alto (para não atrapalhar testes que fazem muitas chamadas).
 *   Para testar rate limit, passe `{ rateLimit: { login: { max: 3, timeWindow: '1 minute' } } }`.
 * - loginAgent(): precisa de um admin existente (createTestAdmin). Devolve cookie + csrf + helpers get/post/put/patch/delete.
 * - agent.inject(...) permite enviar sem CSRF/cookie para testar recusas (use app.inject direto).
 */
import type { FastifyInstance } from 'fastify';
import type { LightMyRequestResponse } from 'fastify';
import { buildApp, type BuildAppOptions } from '../../src/app.js';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './db.js';

const HIGH_LIMIT = { max: 1_000_000, timeWindow: '1 minute' } as const;

export async function buildTestApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = await buildApp({
    logger: false,
    ...opts,
    rateLimit: { global: HIGH_LIMIT, login: HIGH_LIMIT, ...opts.rateLimit },
  });
  await app.ready();
  return app;
}

export interface TestAgent {
  /** Valor do header Cookie (ex.: "achados_sid=..."). */
  cookie: string;
  csrf: string;
  user: { id: string; email: string; role: string };
  headers(extra?: Record<string, string>): Record<string, string>;
  request(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown): Promise<LightMyRequestResponse>;
  get(url: string): Promise<LightMyRequestResponse>;
  post(url: string, payload?: unknown): Promise<LightMyRequestResponse>;
  put(url: string, payload?: unknown): Promise<LightMyRequestResponse>;
  patch(url: string, payload?: unknown): Promise<LightMyRequestResponse>;
  delete(url: string): Promise<LightMyRequestResponse>;
}

/** Extrai "nome=valor" do primeiro Set-Cookie de uma resposta. */
export function extractSessionCookie(res: LightMyRequestResponse): string | null {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const sid = list.find((c) => c.startsWith('achados_sid='));
  return sid ? (sid.split(';')[0] ?? null) : null;
}

export function makeAgent(app: FastifyInstance, cookie: string, csrf: string, user: TestAgent['user']): TestAgent {
  const headers = (extra: Record<string, string> = {}) => ({ cookie, 'x-csrf-token': csrf, ...extra });
  const request: TestAgent['request'] = (method, url, payload) =>
    app.inject({ method, url, headers: headers(), ...(payload !== undefined ? { payload: payload as object } : {}) });
  return {
    cookie,
    csrf,
    user,
    headers,
    request,
    get: (url) => request('GET', url),
    post: (url, payload) => request('POST', url, payload),
    put: (url, payload) => request('PUT', url, payload),
    patch: (url, payload) => request('PATCH', url, payload),
    delete: (url) => request('DELETE', url),
  };
}

export async function loginAgent(
  app: FastifyInstance,
  creds: { email?: string; password?: string } = {},
): Promise<TestAgent> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: creds.email ?? TEST_ADMIN_EMAIL, password: creds.password ?? TEST_ADMIN_PASSWORD },
  });
  if (res.statusCode !== 200) throw new Error(`loginAgent falhou: ${res.statusCode} ${res.body}`);
  const cookie = extractSessionCookie(res);
  if (!cookie) throw new Error('loginAgent: resposta sem cookie de sessão');
  const body = res.json() as { user: TestAgent['user']; csrfToken: string };
  return makeAgent(app, cookie, body.csrfToken, body.user);
}
