import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { sha256 } from '../../src/lib/crypto.js';
import { sessionCookieOptions } from '../../src/lib/session-cookie.js';
import { LOCK_THRESHOLD, MAX_SESSIONS_PER_USER, SESSION_TTL_MS, lockDurationMs, validatePasswordPolicy } from '../../src/services/auth.js';
import { buildTestApp, extractSessionCookie, loginAgent } from '../helpers/app.js';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, closeTestResources, createTestAdmin, resetDb } from '../helpers/db.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  await createTestAdmin();
});

const login = (email: string, password: string) => app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
const badLogin = (n: number, email = TEST_ADMIN_EMAIL) => Promise.all(Array.from({ length: n }, () => login(email, 'senha-errada-qualquer')));

async function failSequentially(n: number) {
  for (let i = 0; i < n; i++) await login(TEST_ADMIN_EMAIL, 'senha-errada-qualquer');
}

describe('login', () => {
  it('login válido devolve usuário + csrfToken e cookie de sessão seguro', async () => {
    const res = await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toMatchObject({ email: TEST_ADMIN_EMAIL, role: 'ADMIN' });
    expect(typeof body.csrfToken).toBe('string');
    expect(body.csrfToken.length).toBeGreaterThanOrEqual(30);
    expect(res.body).not.toMatch(/passwordHash|argon2|tokenHash/);

    const setCookie = String([res.headers['set-cookie']].flat()[0]);
    expect(setCookie).toMatch(/^achados_sid=/);
    expect(setCookie).toMatch(/;\s*HttpOnly/i);
    expect(setCookie).toMatch(/;\s*SameSite=Strict/i);
    expect(setCookie).toMatch(/;\s*Path=\//i);
    expect(setCookie).toMatch(/Max-Age=43200/i);
  });

  it('flag Secure é aplicada quando COOKIE_SECURE=true (produção)', () => {
    expect(sessionCookieOptions(true)).toMatchObject({ secure: true, httpOnly: true, sameSite: 'strict', signed: true });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });

  it('no banco fica só o sha256 do token (nunca o token do cookie)', async () => {
    const res = await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const cookieValue = decodeURIComponent((extractSessionCookie(res) ?? '').split('=')[1] ?? '');
    const rawToken = cookieValue.slice(0, cookieValue.lastIndexOf('.')); // valor.assinatura
    const sessions = await prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).toBe(sha256(rawToken));
    expect(sessions[0]?.tokenHash).not.toBe(rawToken);
    expect(JSON.stringify(sessions)).not.toContain(rawToken);
    const ttl = (sessions[0]?.expiresAt.getTime() ?? 0) - Date.now();
    expect(ttl).toBeGreaterThan(SESSION_TTL_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(SESSION_TTL_MS);
  });

  it('normaliza o e-mail (caixa e espaços)', async () => {
    expect((await login(`  ${TEST_ADMIN_EMAIL.toUpperCase()} `, TEST_ADMIN_PASSWORD)).statusCode).toBe(200);
  });

  it('credenciais inválidas: mensagem genérica, idêntica para e-mail inexistente e senha errada', async () => {
    const wrongPass = await login(TEST_ADMIN_EMAIL, 'senha-errada-qualquer');
    const unknown = await login('ninguem@exemplo.com', 'senha-errada-qualquer');
    expect(wrongPass.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrongPass.json()).toEqual(unknown.json());
    expect(wrongPass.json()).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas.' } });
    expect(wrongPass.headers['set-cookie']).toBeUndefined();
    expect(await prisma.session.count()).toBe(0);
  });

  it('auditoria: login ok e falho (sem gravar o e-mail digitado de usuário inexistente)', async () => {
    await login('digitei-a-senha-aqui@x.com', 'x');
    await login(TEST_ADMIN_EMAIL, 'senha-errada-qualquer');
    await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['auth.login_failed', 'auth.login_failed', 'auth.login']);
    expect(JSON.stringify(logs)).not.toContain('digitei-a-senha-aqui');
  });

  it('valida o corpo (campos faltando / extras)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.c' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    const extra = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.c', password: 'x', role: 'ADMIN' } });
    expect(extra.statusCode).toBe(400);
  });
});

describe('bloqueio progressivo', () => {
  it('política de duração: 5 falhas => 1 min e dobra até o teto de 10 min', () => {
    expect(lockDurationMs(LOCK_THRESHOLD - 1)).toBe(0);
    expect(lockDurationMs(5)).toBe(60_000);
    expect(lockDurationMs(6)).toBe(120_000);
    expect(lockDurationMs(7)).toBe(240_000);
    expect(lockDurationMs(8)).toBe(480_000);
    expect(lockDurationMs(9)).toBe(10 * 60_000);
    expect(lockDurationMs(30)).toBe(10 * 60_000);
  });

  it('após 5 falhas a conta é bloqueada: até a senha correta é recusada (429) e nenhuma sessão é criada', async () => {
    await failSequentially(LOCK_THRESHOLD);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_ADMIN_EMAIL } });
    expect(user.failedLogins).toBe(LOCK_THRESHOLD);
    expect(user.lockedUntil).not.toBeNull();
    const lockMs = (user.lockedUntil?.getTime() ?? 0) - Date.now();
    expect(lockMs).toBeGreaterThan(50_000);
    expect(lockMs).toBeLessThanOrEqual(60_000);

    const res = await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('LOGIN_LOCKED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await prisma.session.count()).toBe(0);
  });

  it('quando o bloqueio expira o login volta e zera o contador; nova falha gera bloqueio MAIOR', async () => {
    await failSequentially(LOCK_THRESHOLD);
    await prisma.user.update({ where: { email: TEST_ADMIN_EMAIL }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    // nova falha após expirar: 6ª => 2 min
    await login(TEST_ADMIN_EMAIL, 'senha-errada-qualquer');
    const locked2 = await prisma.user.findUniqueOrThrow({ where: { email: TEST_ADMIN_EMAIL } });
    expect(locked2.failedLogins).toBe(LOCK_THRESHOLD + 1);
    const lock2Ms = (locked2.lockedUntil?.getTime() ?? 0) - Date.now();
    expect(lock2Ms).toBeGreaterThan(110_000);
    expect(lock2Ms).toBeLessThanOrEqual(120_000);

    await prisma.user.update({ where: { email: TEST_ADMIN_EMAIL }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect((await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)).statusCode).toBe(200);
    const reset = await prisma.user.findUniqueOrThrow({ where: { email: TEST_ADMIN_EMAIL } });
    expect(reset.failedLogins).toBe(0);
    expect(reset.lockedUntil).toBeNull();
  });

  it('falhas isoladas abaixo do limite não bloqueiam', async () => {
    await failSequentially(LOCK_THRESHOLD - 1);
    expect((await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)).statusCode).toBe(200);
  });

  it('tentativas concorrentes também contam (incremento atômico)', async () => {
    await badLogin(8);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_ADMIN_EMAIL } });
    expect(user.failedLogins).toBeGreaterThanOrEqual(LOCK_THRESHOLD);
    expect(user.lockedUntil).not.toBeNull();
  });
});

describe('proteção das rotas /api/*', () => {
  it.each([
    ['GET', '/api/auth/me'],
    ['GET', '/api/settings'],
    ['PUT', '/api/settings'],
    ['GET', '/api/categories'],
    ['GET', '/api/logs'],
    ['GET', '/api/audit'],
    ['GET', '/api/notifications'],
    ['POST', '/api/auth/logout'],
    ['GET', '/api/rota-que-nao-existe'],
  ] as const)('%s %s sem cookie => 401 no formato do contrato', async (method, url) => {
    const res = await app.inject({ method, url, payload: method === 'GET' ? undefined : {} });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Não autenticado.' } });
  });

  it('URL com caracteres codificados não contorna a autenticação', async () => {
    for (const url of ['/%61pi/settings', '/api/%73ettings', '/api/settings?x=1', '/api//settings']) {
      const res = await app.inject({ method: 'GET', url });
      expect([401, 404]).toContain(res.statusCode);
      expect(res.body).not.toContain('monitoring');
    }
  });

  it('cookie forjado, adulterado ou de sessão inexistente => 401', async () => {
    const agent = await loginAgent(app);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: 'achados_sid=qualquer-coisa' } })).statusCode).toBe(401);
    const tampered = agent.cookie.slice(0, -2) + (agent.cookie.endsWith('AA') ? 'BB' : 'AA');
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: tampered } })).statusCode).toBe(401);
    // sessão removida no servidor
    await prisma.session.deleteMany();
    expect((await agent.get('/api/auth/me')).statusCode).toBe(401);
  });

  it('GET /api/auth/me devolve usuário e csrfToken (sem segredos)', async () => {
    const agent = await loginAgent(app);
    const res = await agent.get('/api/auth/me');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ user: { id: agent.user.id, email: TEST_ADMIN_EMAIL, role: 'ADMIN' }, csrfToken: agent.csrf });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rotas /health e /ready continuam públicas', async () => {
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });
});

describe('CSRF', () => {
  it('mutação com sessão válida mas SEM X-CSRF-Token => 403 CSRF_INVALID', async () => {
    const agent = await loginAgent(app);
    for (const [method, url] of [
      ['PUT', '/api/settings'],
      ['POST', '/api/auth/change-password'],
      ['POST', '/api/auth/logout'],
      ['POST', '/api/notifications/read-all'],
    ] as const) {
      const res = await app.inject({ method, url, headers: { cookie: agent.cookie }, payload: {} });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
      expect(res.json().error.code).toBe('CSRF_INVALID');
    }
    expect(await prisma.session.count()).toBe(1); // logout sem CSRF não encerrou a sessão
  });

  it('token CSRF errado (ou de outra sessão) => 403', async () => {
    const a = await loginAgent(app);
    const b = await loginAgent(app);
    const wrong = await app.inject({ method: 'PUT', url: '/api/settings', headers: { cookie: a.cookie, 'x-csrf-token': 'errado' }, payload: {} });
    expect(wrong.statusCode).toBe(403);
    const crossSession = await app.inject({ method: 'PUT', url: '/api/settings', headers: { cookie: a.cookie, 'x-csrf-token': b.csrf }, payload: {} });
    expect(crossSession.statusCode).toBe(403);
  });

  it('GET não exige CSRF; mutação com CSRF correto passa', async () => {
    const agent = await loginAgent(app);
    expect((await app.inject({ method: 'GET', url: '/api/settings', headers: { cookie: agent.cookie } })).statusCode).toBe(200);
    expect((await agent.put('/api/settings', {})).statusCode).toBe(200);
  });
});

describe('logout', () => {
  it('invalida a sessão no servidor e limpa o cookie', async () => {
    const agent = await loginAgent(app);
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: agent.cookie, 'x-csrf-token': agent.csrf, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(String([res.headers['set-cookie']].flat()[0])).toMatch(/achados_sid=;.*(Expires=Thu, 01 Jan 1970|Max-Age=0)/i);
    expect(await prisma.session.count()).toBe(0);
    // o MESMO cookie não funciona mais
    expect((await agent.get('/api/auth/me')).statusCode).toBe(401);
    expect(await prisma.auditLog.count({ where: { action: 'auth.logout' } })).toBe(1);
  });
});

describe('ciclo de vida da sessão', () => {
  it('sessão expirada => 401 e a linha é removida', async () => {
    const agent = await loginAgent(app);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await agent.get('/api/auth/me')).statusCode).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it('renovação deslizante: uso após 5 min estende a validade para 12h e reenvia o cookie', async () => {
    const agent = await loginAgent(app);
    await prisma.session.updateMany({ data: { lastUsedAt: new Date(Date.now() - 5 * 60_000), expiresAt: new Date(Date.now() + 60 * 60_000) } });
    const res = await agent.get('/api/auth/me');
    expect(res.statusCode).toBe(200);
    expect(String([res.headers['set-cookie']].flat()[0])).toMatch(/^achados_sid=/);
    const s = await prisma.session.findFirstOrThrow();
    expect(s.expiresAt.getTime() - Date.now()).toBeGreaterThan(SESSION_TTL_MS - 60_000);
    // uso imediato em seguida não regrava a sessão
    const again = await agent.get('/api/auth/me');
    expect(again.headers['set-cookie']).toBeUndefined();
  });

  it('teto absoluto de 7 dias mesmo com renovação', async () => {
    const agent = await loginAgent(app);
    await prisma.session.updateMany({ data: { createdAt: new Date(Date.now() - 8 * 24 * 3600_000), expiresAt: new Date(Date.now() + 3600_000) } });
    expect((await agent.get('/api/auth/me')).statusCode).toBe(401);
  });

  it(`limita a ${MAX_SESSIONS_PER_USER} sessões por usuário descartando as mais antigas`, async () => {
    const agents = [];
    for (let i = 0; i < MAX_SESSIONS_PER_USER + 2; i++) {
      agents.push(await loginAgent(app));
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(await prisma.session.count()).toBe(MAX_SESSIONS_PER_USER);
    expect((await agents[0]!.get('/api/auth/me')).statusCode).toBe(401);
    expect((await agents[agents.length - 1]!.get('/api/auth/me')).statusCode).toBe(200);
  });
});

describe('troca de senha', () => {
  const NEW_PASSWORD = 'Outra-Senha-Forte-456!';

  it('troca a senha, invalida as OUTRAS sessões e mantém a atual', async () => {
    const current = await loginAgent(app);
    const other = await loginAgent(app);
    const res = await current.post('/api/auth/change-password', { currentPassword: TEST_ADMIN_PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    expect((await current.get('/api/auth/me')).statusCode).toBe(200);
    expect((await other.get('/api/auth/me')).statusCode).toBe(401);
    expect((await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)).statusCode).toBe(401);
    expect((await login(TEST_ADMIN_EMAIL, NEW_PASSWORD)).statusCode).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'auth.change_password' } });
    expect(JSON.stringify(audit)).not.toContain(NEW_PASSWORD);
  });

  it('senha atual incorreta => 400 (não 401) e conta como falha', async () => {
    const agent = await loginAgent(app);
    const res = await agent.post('/api/auth/change-password', { currentPassword: 'errada-errada-12', newPassword: NEW_PASSWORD });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect((await prisma.user.findUniqueOrThrow({ where: { email: TEST_ADMIN_EMAIL } })).failedLogins).toBe(1);
  });

  it('política: mínimo de 12 caracteres, diferente da atual, não trivial', async () => {
    const agent = await loginAgent(app);
    const short = await agent.post('/api/auth/change-password', { currentPassword: TEST_ADMIN_PASSWORD, newPassword: 'curta123' });
    expect(short.statusCode).toBe(400);
    expect(short.json().error.message).toMatch(/12 caracteres/);
    const same = await agent.post('/api/auth/change-password', { currentPassword: TEST_ADMIN_PASSWORD, newPassword: TEST_ADMIN_PASSWORD });
    expect(same.statusCode).toBe(400);
    // senha inalterada
    expect((await login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)).statusCode).toBe(200);
    expect(validatePasswordPolicy('aaaaaaaaaaaaaaaa')).toMatch(/simples/);
    expect(validatePasswordPolicy('x'.repeat(200))).toMatch(/máximo/);
    expect(validatePasswordPolicy('Senha-Valida-123')).toBeNull();
  });
});

describe('perfil somente leitura (VIEWER)', () => {
  it('lê, mas não altera nada; ainda pode encerrar a própria sessão', async () => {
    await createTestAdmin({ email: 'leitor@teste.local', password: 'Leitor-Senha-123!', role: 'VIEWER' });
    const viewer = await loginAgent(app, { email: 'leitor@teste.local', password: 'Leitor-Senha-123!' });
    expect((await viewer.get('/api/settings')).statusCode).toBe(200);
    const put = await viewer.put('/api/settings', { publishing: { autoPublish: true } });
    expect(put.statusCode).toBe(403);
    expect(put.json().error.code).toBe('FORBIDDEN');
    expect((await viewer.post('/api/auth/logout')).statusCode).toBe(200);
  });
});

describe('formato de erros e entrada', () => {
  it('JSON inválido => 400 INVALID_JSON; 404 autenticado usa o formato do contrato', async () => {
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: '{nao é json' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('INVALID_JSON');
    const agent = await loginAgent(app);
    const nf = await agent.get('/api/nao-existe');
    expect(nf.statusCode).toBe(404);
    expect(nf.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
  });

  it('cabeçalhos de segurança (helmet) presentes', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
