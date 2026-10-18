import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { env } from '../../src/lib/env.js';
import { createOrUpdateAdmin, verifyPassword } from '../../src/services/auth.js';
import { parseAdminArgs } from '../../src/scripts/create-admin.js';
import { buildTestApp, loginAgent, makeAgent } from '../helpers/app.js';
import { closeTestResources, createTestAdmin, resetDb } from '../helpers/db.js';

const run = promisify(execFile);
const API_DIR = path.resolve(import.meta.dirname, '../..');

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

describe('registro automático das rotas reais', () => {
  it('todas as áreas da plataforma respondem para um admin autenticado', async () => {
    const agent = await loginAgent(app);
    for (const url of ['/api/auth/me', '/api/settings', '/api/categories', '/api/logs', '/api/audit', '/api/notifications']) {
      expect((await agent.get(url)).statusCode, url).toBe(200);
    }
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/ready' })).statusCode).toBe(200);
  });
});

describe('registro automático: diretório de rotas arbitrário', () => {
  let dir = '';
  let custom: FastifyInstance | null = null;
  afterEach(async () => {
    await custom?.close();
    custom = null;
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('aceita .ts e .js, ignora *.test.*, _arquivos e .d.ts; rotas fora de /api também exigem sessão', async () => {
    dir = await mkdtemp(path.join(API_DIR, 'tests', '.tmp-routes-'));
    const route = (p: string, body: string) => `export default async function (app) { app.get('${p}', async () => (${body})); }\n`;
    await writeFile(path.join(dir, 'um.ts'), route('/api/sim/um', "{ rota: 'ts' }"));
    await writeFile(path.join(dir, 'dois.js'), route('/api/sim/dois', "{ rota: 'js' }"));
    await writeFile(path.join(dir, 'fora.js'), route('/interno/fora', "{ rota: 'fora-do-api' }"));
    await writeFile(
      path.join(dir, 'erros.js'),
      `import { PublishBlockedError } from '${path.join(API_DIR, 'src/lib/errors.ts').replace(/\\/g, '/')}';
export default async function (app) {
  app.get('/api/sim/boom', async () => { throw new Error('detalhe interno com senha=SEGREDO-INTERNO'); });
  app.get('/api/sim/bloqueada', async () => { throw new PublishBlockedError('NO_VALIDATED_LINK'); });
}
`,
    );
    // (.test.js / .spec.ts: nomes que o vitest do projeto não coleta enquanto o diretório temporário existe)
    await writeFile(path.join(dir, 'ignorado.test.js'), route('/api/sim/teste', '{}'));
    await writeFile(path.join(dir, 'ignorado.spec.ts'), route('/api/sim/spec', '{}'));
    await writeFile(path.join(dir, '_helper.ts'), 'throw new Error("não deveria ser carregado");\n');
    await writeFile(path.join(dir, 'tipos.d.ts'), 'export {};\n');

    custom = await buildTestApp({ routesDir: dir });
    // o app customizado não tem rota de login: reaproveita a sessão (mesmo banco e mesmo SESSION_SECRET)
    const main = await loginAgent(app);
    const agent = makeAgent(custom, main.cookie, main.csrf, main.user);

    expect((await agent.get('/api/sim/um')).json()).toEqual({ rota: 'ts' });
    expect((await agent.get('/api/sim/dois')).json()).toEqual({ rota: 'js' });
    expect((await agent.get('/api/sim/teste')).statusCode).toBe(404);
    expect((await agent.get('/api/sim/spec')).statusCode).toBe(404);
    // sem sessão: negado por padrão (inclusive fora de /api)
    expect((await custom.inject({ method: 'GET', url: '/api/sim/um' })).statusCode).toBe(401);
    expect((await custom.inject({ method: 'GET', url: '/interno/fora' })).statusCode).toBe(401);
    expect((await agent.get('/interno/fora')).json()).toEqual({ rota: 'fora-do-api' });

    // erros inesperados não vazam detalhes; erros de domínio saem no formato do contrato
    const boom = await agent.get('/api/sim/boom');
    expect(boom.statusCode).toBe(500);
    expect(boom.json().error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente em instantes.' });
    expect(boom.body).not.toContain('SEGREDO-INTERNO');
    const blocked = await agent.get('/api/sim/bloqueada');
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe('NO_VALIDATED_LINK');
  });

  it('arquivo de rota sem export default falha de forma explícita', async () => {
    dir = await mkdtemp(path.join(API_DIR, 'tests', '.tmp-routes-'));
    await writeFile(path.join(dir, 'ruim.js'), 'export const x = 1;\n');
    await expect(buildTestApp({ routesDir: dir })).rejects.toThrow(/export default/);
  });
});

describe('limites de entrada', () => {
  it('corpo maior que o limite => 413 e tipo de conteúdo não suportado => 415, ambos no formato do contrato', async () => {
    const big = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(3 * 1024 * 1024) }) });
    expect(big.statusCode).toBe(413);
    expect(big.json().error.code).toBe('PAYLOAD_TOO_LARGE');
    const text = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/xml' }, payload: '<a/>' });
    expect(text.statusCode).toBe(415);
    expect(text.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });
});

describe('OpenAPI / Swagger UI', () => {
  it('/docs/json descreve as rotas e os corpos (gerados dos schemas zod)', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\./);
    const login = spec.paths['/api/auth/login'].post;
    expect(login.requestBody.content['application/json'].schema.properties).toHaveProperty('email');
    expect(login.requestBody.content['application/json'].schema.properties).toHaveProperty('password');
    expect(spec.paths['/api/settings']).toHaveProperty('put');
    expect(spec.paths['/api/categories/{id}']).toHaveProperty('patch');
    expect(spec.paths).toHaveProperty(['/health']);
    expect(spec.components.securitySchemes.cookieAuth.name).toBe('achados_sid');
    expect(JSON.stringify(spec)).not.toContain('$schema');
  });

  it('interface /docs é servida (HTML)', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/' });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['content-type'])).toMatch(/text\/html/);
  });

  it('em produção a documentação exige sessão', async () => {
    const original = env.isProduction;
    (env as { isProduction: boolean }).isProduction = true;
    try {
      expect((await app.inject({ method: 'GET', url: '/docs/json' })).statusCode).toBe(401);
      const agent = await loginAgent(app);
      expect((await agent.get('/docs/json')).statusCode).toBe(200);
    } finally {
      (env as { isProduction: boolean }).isProduction = original;
    }
  });
});

describe('create-admin', () => {
  it('parseAdminArgs: variáveis de ambiente, flags e posicionais', () => {
    expect(parseAdminArgs([], { ADMIN_EMAIL: 'a@b.com', ADMIN_PASSWORD: 'x' })).toEqual({ email: 'a@b.com', password: 'x' });
    expect(parseAdminArgs(['--email', 'c@d.com', '--password=senha-123456789'], {})).toEqual({ email: 'c@d.com', password: 'senha-123456789' });
    expect(parseAdminArgs(['e@f.com', 'pw-pw-pw-pw-pw'], {})).toEqual({ email: 'e@f.com', password: 'pw-pw-pw-pw-pw' });
    expect(parseAdminArgs([], {})).toEqual({});
  });

  it('cria o admin com hash argon2id; atualizar redefine a senha e encerra sessões', async () => {
    const created = await createOrUpdateAdmin('Novo.Admin@Exemplo.com ', 'Senha-Longa-Valida-1');
    expect(created).toMatchObject({ created: true, user: { email: 'novo.admin@exemplo.com', role: 'ADMIN' } });
    const row = await prisma.user.findUniqueOrThrow({ where: { email: 'novo.admin@exemplo.com' } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain('Senha-Longa-Valida-1');
    expect(await verifyPassword(row.passwordHash, 'Senha-Longa-Valida-1')).toBe(true);

    const agent = await loginAgent(app, { email: 'novo.admin@exemplo.com', password: 'Senha-Longa-Valida-1' });
    const again = await createOrUpdateAdmin('novo.admin@exemplo.com', 'Outra-Senha-Valida-2');
    expect(again.created).toBe(false);
    expect((await agent.get('/api/auth/me')).statusCode).toBe(401); // sessões antigas encerradas
    expect((await prisma.user.count({ where: { email: 'novo.admin@exemplo.com' } }))).toBe(1);
    await loginAgent(app, { email: 'novo.admin@exemplo.com', password: 'Outra-Senha-Valida-2' });
  });

  it('recusa senha com menos de 12 caracteres e e-mail inválido', async () => {
    await expect(createOrUpdateAdmin('a@b.com', 'curta-demai')).rejects.toThrow(/12 caracteres/);
    await expect(createOrUpdateAdmin('nao-é-email', 'Senha-Longa-Valida-1')).rejects.toThrow(/E-mail inválido/);
    expect(await prisma.user.count({ where: { email: 'a@b.com' } })).toBe(0);
  });

  it('script via CLI: cria o usuário, não imprime a senha e retorna código 1 se a senha for fraca', async () => {
    const tsx = path.resolve(API_DIR, '../../node_modules/.bin/tsx');
    const childEnv = { ...process.env, NODE_ENV: 'test', DATABASE_URL: env.DATABASE_URL, REDIS_URL: env.REDIS_URL };
    const ok = await run(tsx, ['src/scripts/create-admin.ts'], {
      cwd: API_DIR,
      env: { ...childEnv, ADMIN_EMAIL: 'cli@exemplo.com', ADMIN_PASSWORD: 'Senha-CLI-Valida-123' },
    });
    expect(ok.stdout).toContain('cli@exemplo.com');
    expect(ok.stdout + ok.stderr).not.toContain('Senha-CLI-Valida-123');
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'cli@exemplo.com' } })).role).toBe('ADMIN');

    await expect(
      run(tsx, ['src/scripts/create-admin.ts'], { cwd: API_DIR, env: { ...childEnv, ADMIN_EMAIL: 'fraca@exemplo.com', ADMIN_PASSWORD: 'curta' } }),
    ).rejects.toMatchObject({ code: 1 });
    expect(await prisma.user.count({ where: { email: 'fraca@exemplo.com' } })).toBe(0);
    // e sem credenciais também falha com instrução de uso
    await expect(run(tsx, ['src/scripts/create-admin.ts'], { cwd: API_DIR, env: { ...childEnv, ADMIN_EMAIL: '', ADMIN_PASSWORD: '' } })).rejects.toMatchObject({ code: 1 });
  });
});
