/**
 * Rotas /api/integrations*: credenciais WRITE-ONLY, CRUD de canais, "canal automático só ativa após teste OK",
 * teste de conexão e os modos A/B/C com status real. Servidores Telegram/WhatsApp simulados em localhost.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { decryptJson } from '../../src/lib/crypto.js';
import { prisma } from '../../src/lib/db.js';
import { setSsrfAllowPrivateForTests } from '../../src/lib/ssrf.js';
import { closeQueues } from '../../src/queues/queues.js';
import { loadCredentialValues } from '../../src/services/channels.js';
import { updateSettings } from '../../src/services/settings.js';
import { buildTestApp, loginAgent, type TestAgent } from '../helpers/app.js';
import { closeTestResources, createTestAdmin, resetDb, resetRedis } from '../helpers/db.js';
import { TG_TOKEN, WA_TOKEN, WH_SECRET, leaks, reply, seedChannel, seedCredential, seedManualChannel, seedOffer, seedPublication, startSim, type SimServer } from '../helpers/publishing-fixtures.js';

let app: FastifyInstance;
let agent: TestAgent;
let tg: SimServer;
let tgMode: 'ok' | 'unauthorized' | 'chat403' | 'server-error' = 'ok';
let wa: SimServer;
let waStatus = 200;

beforeAll(async () => {
  setSsrfAllowPrivateForTests(true);
  app = await buildTestApp();
  tg = await startSim((hit, res) => {
    const method = hit.url.split('/').pop();
    if (tgMode === 'unauthorized') return reply(res, 401, { ok: false, error_code: 401, description: 'Unauthorized' });
    if (tgMode === 'server-error') return reply(res, 500, { ok: false, description: 'boom' });
    if (method === 'getMe') return reply(res, 200, { ok: true, result: { username: 'achados_bot' } });
    if (method === 'getChat') return tgMode === 'chat403' ? reply(res, 403, { ok: false, description: 'Forbidden: bot is not a member' }) : reply(res, 200, { ok: true, result: { title: 'Achados VIP' } });
    return reply(res, 200, { ok: true, result: { message_id: 1 } });
  });
  wa = await startSim((_h, res) => (waStatus === 200 ? reply(res, 200, { display_phone_number: '+55 11 90000-0000', subject: 'g' }) : reply(res, waStatus, { error: { message: 'Invalid OAuth access token', code: 190 } })));
});
afterAll(async () => {
  await app.close();
  await tg.close();
  await wa.close();
  setSsrfAllowPrivateForTests(false);
  await closeQueues();
  await closeTestResources();
});
beforeEach(async () => {
  await resetDb();
  await resetRedis();
  await createTestAdmin();
  agent = await loginAgent(app);
  tg.hits.length = 0;
  wa.hits.length = 0;
  tgMode = 'ok';
  waStatus = 200;
});

const tgCred = async (token = TG_TOKEN) => (await agent.post('/api/integrations/credentials', { provider: 'telegram', name: 'Bot principal', values: { botToken: token } })).json() as { id: string };
const tgConfig = () => ({ chatId: '@canal_teste', baseUrl: tg.url });
const createTg = (over: Record<string, unknown> = {}) => agent.post('/api/integrations/channels', { type: 'TELEGRAM', name: 'Telegram', config: tgConfig(), ...over });
const overview = async () => (await agent.get('/api/integrations')).json();

describe('autenticação, CSRF e perfil', () => {
  const mutations: [string, string][] = [
    ['POST', '/api/integrations/credentials'],
    ['DELETE', '/api/integrations/credentials/x'],
    ['POST', '/api/integrations/channels'],
    ['PATCH', '/api/integrations/channels/x'],
    ['DELETE', '/api/integrations/channels/x'],
    ['POST', '/api/integrations/channels/x/test'],
    ['POST', '/api/integrations/source/test'],
  ];
  it('sem login: tudo responde 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/integrations' })).statusCode).toBe(401);
    for (const [method, url] of mutations) expect((await app.inject({ method: method as 'POST', url, payload: {} })).statusCode, `${method} ${url}`).toBe(401);
  });

  it('com sessão mas SEM (ou com) token CSRF errado: 403 CSRF_INVALID e nada é gravado', async () => {
    for (const headers of [{ cookie: agent.cookie }, { cookie: agent.cookie, 'x-csrf-token': 'errado' }]) {
      const res = await app.inject({ method: 'POST', url: '/api/integrations/credentials', headers, payload: { provider: 'telegram', name: 'x', values: { botToken: TG_TOKEN } } });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('CSRF_INVALID');
    }
    expect(await prisma.integrationCredential.count()).toBe(0);
  });

  it('perfil VIEWER lê, mas não altera integrações (403 FORBIDDEN)', async () => {
    await createTestAdmin({ email: 'viewer@teste.local', role: 'VIEWER' });
    const viewer = await loginAgent(app, { email: 'viewer@teste.local' });
    expect((await viewer.get('/api/integrations')).statusCode).toBe(200);
    const res = await viewer.post('/api/integrations/credentials', { provider: 'telegram', name: 'x', values: { botToken: TG_TOKEN } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    expect(await prisma.integrationCredential.count()).toBe(0);
  });
});

describe('credenciais são WRITE-ONLY (sim) (regra inegociável nº 5)', () => {
  it('a resposta traz só {id, provider, name, hint}: nunca o segredo nem "values"', async () => {
    const res = await agent.post('/api/integrations/credentials', { provider: 'telegram', name: '  Bot principal ', values: { botToken: TG_TOKEN } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body).sort()).toEqual(['hint', 'id', 'name', 'provider', 'status']);
    expect(body).toMatchObject({ provider: 'telegram', name: 'Bot principal', hint: `••••${TG_TOKEN.slice(-4)}`, status: 'UNKNOWN' });
    expect(leaks(res.body)).toEqual([]);
    expect(res.body).not.toContain('values');
  });

  it('o segredo fica criptografado no banco (AES-256-GCM), é recuperável só pelo serviço e não aparece em nenhuma outra tabela/listagem', async () => {
    const body = (await agent.post('/api/integrations/credentials', { provider: 'whatsapp_cloud', name: 'Meta', values: { accessToken: WA_TOKEN } })).json();
    const row = await prisma.integrationCredential.findUniqueOrThrow({ where: { id: body.id } });
    expect(row.encrypted).not.toContain(WA_TOKEN);
    expect(decryptJson<{ accessToken: string }>(row.encrypted).accessToken).toBe(WA_TOKEN);
    expect(await loadCredentialValues(body.id)).toEqual({ accessToken: WA_TOKEN });

    const ov = await agent.get('/api/integrations');
    expect(ov.json().credentials).toEqual([{ id: body.id, provider: 'whatsapp_cloud', name: 'Meta', hint: `••••${WA_TOKEN.slice(-4)}`, status: 'UNKNOWN' }]);
    expect(leaks(ov.body)).toEqual([]);
    for (const url of ['/api/audit', '/api/logs', '/api/notifications']) expect(leaks((await agent.get(url)).body), url).toEqual([]);
    const audits = await prisma.auditLog.findMany({ where: { action: 'credential.save' } });
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain(WA_TOKEN);
    expect(audits[0]!.after).toMatchObject({ provider: 'whatsapp_cloud', name: 'Meta' });
    const everything = JSON.stringify({ a: await prisma.auditLog.findMany(), l: await prisma.systemLog.findMany(), n: await prisma.notification.findMany(), c: await prisma.publishingChannel.findMany() });
    expect(leaks(everything)).toEqual([]);
  });

  it('não existe rota para ler uma credencial (GET → 404)', async () => {
    const { id } = await tgCred();
    for (const url of [`/api/integrations/credentials/${id}`, '/api/integrations/credentials']) {
      const res = await agent.get(url);
      expect(res.statusCode, url).toBe(404);
      expect(leaks(res.body)).toEqual([]);
    }
  });

  it('validação: erros apontam o campo, mas NUNCA ecoam o valor enviado', async () => {
    const bad = 'token-invalido-com-segredo-SUPER-SECRETO-123';
    const cases: [string, unknown][] = [
      ['provedor desconhecido', { provider: 'instagram', name: 'x', values: { botToken: bad } }],
      ['formato inválido do token', { provider: 'telegram', name: 'x', values: { botToken: bad } }],
      ['campo extra nos valores (strict)', { provider: 'telegram', name: 'x', values: { botToken: TG_TOKEN, extra: bad } }],
      ['campo extra na raiz (strict)', { provider: 'telegram', name: 'x', values: { botToken: TG_TOKEN }, secret: bad }],
      ['segredo do webhook curto', { provider: 'webhook', name: 'x', values: { secret: 'curto' } }],
      ['sem nome', { provider: 'telegram', name: '   ', values: { botToken: TG_TOKEN } }],
      ['values ausente', { provider: 'telegram', name: 'x' }],
    ];
    for (const [label, payload] of cases) {
      const res = await agent.post('/api/integrations/credentials', payload);
      expect(res.statusCode, label).toBe(400);
      expect(res.json().error.code, label).toBe('VALIDATION_ERROR');
      expect(res.body, label).not.toContain('SUPER-SECRETO');
      expect(res.body, label).not.toContain(TG_TOKEN);
    }
    expect(await prisma.integrationCredential.count()).toBe(0);
  });

  it('salvar de novo (mesmo provedor+nome) substitui o segredo, mantém o id, atualiza o hint e volta os canais ligados a "não testado"', async () => {
    const first = await tgCred();
    const ch = (await createTg({ credentialId: first.id, enabled: true })).json();
    expect(ch.status).toBe('CONNECTED');
    const newToken = '987654321:BBHdqTcvCH1vGWJxfSeofSAs0K5PALDtrocado';
    const second = await agent.post('/api/integrations/credentials', { provider: 'telegram', name: 'Bot principal', values: { botToken: newToken } });
    expect(second.json()).toMatchObject({ id: first.id, hint: `••••${newToken.slice(-4)}` });
    expect(await prisma.integrationCredential.count()).toBe(1);
    expect(await loadCredentialValues(first.id)).toEqual({ botToken: newToken });
    const channel = await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } });
    expect(channel).toMatchObject({ status: 'UNKNOWN', lastCheckedAt: null });
    expect(channel.statusDetail).toMatch(/teste a conexão novamente/);
  });

  it('salvar credencial resolve o alerta de "autenticação necessária" dos canais que a usam', async () => {
    const { id } = await tgCred();
    const ch = (await createTg({ credentialId: id, enabled: true })).json();
    tgMode = 'unauthorized';
    await agent.post(`/api/integrations/channels/${ch.id}/test`);
    expect(await prisma.notification.count({ where: { dedupeKey: `channel-auth:${ch.id}`, readAt: null } })).toBe(1);
    await agent.post('/api/integrations/credentials', { provider: 'telegram', name: 'Bot principal', values: { botToken: TG_TOKEN } });
    expect(await prisma.notification.count({ where: { dedupeKey: `channel-auth:${ch.id}`, readAt: null } })).toBe(0);
  });

  it('excluir credencial: 409 se há canal usando, 404 se não existe, ok se livre', async () => {
    const { id } = await tgCred();
    await createTg({ credentialId: id });
    const used = await agent.delete(`/api/integrations/credentials/${id}`);
    expect(used.statusCode).toBe(409);
    expect(used.json().error.code).toBe('CREDENTIAL_IN_USE');
    expect((await agent.delete('/api/integrations/credentials/nao-existe')).statusCode).toBe(404);
    const free = await seedCredential('webhook', { secret: WH_SECRET }, 'livre');
    expect((await agent.delete(`/api/integrations/credentials/${free.id}`)).json()).toEqual({ ok: true });
    expect(await prisma.integrationCredential.count({ where: { id: free.id } })).toBe(0);
  });
});

describe('CRUD de canais e validação (sim)', () => {
  it('canal automático criado sem "enabled" fica DESABILITADO e "não testado" — sem tocar a rede', async () => {
    const { id } = await tgCred();
    const res = await createTg({ credentialId: id });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ type: 'TELEGRAM', name: 'Telegram', enabled: false, status: 'UNKNOWN', automatic: true, credentialId: id, lastCheckedAt: null });
    expect(res.json().statusDetail).toMatch(/Ainda não testado/);
    expect(tg.hits).toHaveLength(0);
  });

  it('canal automático só é criado ATIVO se o teste real passar; senão 409 CHANNEL_NOT_CONNECTED e nada é gravado', async () => {
    const { id } = await tgCred();
    tgMode = 'unauthorized';
    const bad = await createTg({ credentialId: id, enabled: true });
    expect(bad.statusCode).toBe(409);
    expect(bad.json().error).toMatchObject({ code: 'CHANNEL_NOT_CONNECTED', details: { status: 'AUTH_REQUIRED' } });
    expect(await prisma.publishingChannel.count()).toBe(0);
    tgMode = 'ok';
    const good = await createTg({ credentialId: id, enabled: true });
    expect(good.statusCode).toBe(200);
    expect(good.json()).toMatchObject({ enabled: true, status: 'CONNECTED' });
    expect(good.json().lastCheckedAt).toBeTruthy();
    expect(good.json().statusDetail).toContain('@achados_bot');
    expect(tg.hits.map((h) => h.url.split('/').pop())).toEqual(['getMe', 'getMe', 'getChat']);
  });

  it('criar canal ativo sem credencial => 409 (AUTH_REQUIRED), nunca ativa por suposição', async () => {
    const res = await createTg({ enabled: true });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.details.status).toBe('AUTH_REQUIRED');
    expect(await prisma.publishingChannel.count()).toBe(0);
  });

  it('fila manual: ativa já na criação (CONNECTED), sem credencial e sem rede', async () => {
    const res = await agent.post('/api/integrations/channels', { type: 'WHATSAPP_MANUAL_QUEUE', name: 'Fila', config: { groupName: 'ACHADOS VIP' }, enabled: true });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ type: 'WHATSAPP_MANUAL_QUEUE', enabled: true, status: 'CONNECTED', automatic: false, config: { groupName: 'ACHADOS VIP' } });
    const off = await agent.post('/api/integrations/channels', { type: 'WHATSAPP_MANUAL_QUEUE', name: 'Fila 2' });
    expect(off.json()).toMatchObject({ enabled: false, status: 'DISABLED' }); // desabilitada: não conta como conectada
  });

  it('validações da configuração: chaves desconhecidas (inclusive token/secret), chatId inválido, tipo errado', async () => {
    const { id } = await tgCred();
    const cases: [string, Record<string, unknown>][] = [
      ['token na config', { type: 'TELEGRAM', name: 'x', config: { ...tgConfig(), token: 'segredo' }, credentialId: id }],
      ['chatId inválido', { type: 'TELEGRAM', name: 'x', config: { chatId: 'canal sem arroba' }, credentialId: id }],
      ['config vazia p/ Telegram', { type: 'TELEGRAM', name: 'x', config: {}, credentialId: id }],
      ['tipo inexistente', { type: 'SMS', name: 'x', config: {} }],
      ['campo desconhecido na raiz', { type: 'WHATSAPP_MANUAL_QUEUE', name: 'x', config: {}, apiKey: 'x' }],
      ['nome vazio', { type: 'WHATSAPP_MANUAL_QUEUE', name: ' ', config: {} }],
      ['phoneNumberId não numérico', { type: 'WHATSAPP_CLOUD_GROUP', name: 'x', config: { phoneNumberId: 'abc', groupId: 'g-1' } }],
    ];
    for (const [label, payload] of cases) {
      const res = await agent.post('/api/integrations/channels', payload);
      expect(res.statusCode, label).toBe(400);
      expect(res.json().error.code, label).toBe('VALIDATION_ERROR');
      expect(res.body, label).not.toContain('"segredo"');
    }
    expect(await prisma.publishingChannel.count()).toBe(0);
  });

  it('credencial incompatível com o canal é recusada (provedor errado, inexistente, ou canal que não usa credencial)', async () => {
    const wh = await seedCredential('webhook', { secret: WH_SECRET }, 'wh');
    const a = await createTg({ credentialId: wh.id });
    expect(a.statusCode).toBe(400);
    expect(a.json().error.details[0]).toMatchObject({ path: 'credentialId' });
    expect((await createTg({ credentialId: 'inexistente' })).statusCode).toBe(400);
    const manual = await agent.post('/api/integrations/channels', { type: 'WHATSAPP_MANUAL_QUEUE', name: 'x', config: {}, credentialId: wh.id });
    expect(manual.statusCode).toBe(400);
  });

  it('webhook para IP privado/localhost é recusado na criação (SSRF) e nunca chega ao banco', async () => {
    setSsrfAllowPrivateForTests(false);
    try {
      const wh = await seedCredential('webhook', { secret: WH_SECRET }, 'wh');
      for (const url of ['http://127.0.0.1:9999/hook', 'http://localhost/hook', 'http://169.254.169.254/latest', 'https://10.0.0.8/x', 'http://192.168.1.2/']) {
        const res = await agent.post('/api/integrations/channels', { type: 'WEBHOOK', name: 'wh', config: { url }, credentialId: wh.id });
        expect(res.statusCode, url).toBe(400);
        expect(res.json().error.message).toMatch(/URL do webhook não permitida/);
        expect(res.json().error.details[0].message, url).toMatch(/bloqueado|não permitido|interno/);
      }
      expect(await prisma.publishingChannel.count()).toBe(0);
    } finally {
      setSsrfAllowPrivateForTests(true);
    }
  });

  it('PATCH: ativar exige teste real OK; renomear não testa; mudar config/credencial re-testa; desativar não usa rede', async () => {
    const { id } = await tgCred();
    const ch = (await createTg({ credentialId: id })).json();
    tgMode = 'unauthorized';
    const refused = await agent.patch(`/api/integrations/channels/${ch.id}`, { enabled: true });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('CHANNEL_NOT_CONNECTED');
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } })).enabled).toBe(false);

    tgMode = 'ok';
    const on = await agent.patch(`/api/integrations/channels/${ch.id}`, { enabled: true });
    expect(on.json()).toMatchObject({ enabled: true, status: 'CONNECTED' });

    tg.hits.length = 0;
    const renamed = await agent.patch(`/api/integrations/channels/${ch.id}`, { name: '  Novo nome ' });
    expect(renamed.json()).toMatchObject({ name: 'Novo nome', enabled: true, status: 'CONNECTED' });
    expect(tg.hits).toHaveLength(0); // renomear não testa

    const reconfigured = await agent.patch(`/api/integrations/channels/${ch.id}`, { config: { chatId: '@outro_canal', baseUrl: tg.url } });
    expect(reconfigured.json().config).toMatchObject({ chatId: '@outro_canal' });
    expect(tg.hits.length).toBeGreaterThan(0); // mudou a conexão: testou de novo

    tgMode = 'unauthorized';
    const badConfig = await agent.patch(`/api/integrations/channels/${ch.id}`, { config: { chatId: '@terceiro_canal', baseUrl: tg.url } });
    expect(badConfig.statusCode).toBe(409);
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } })).config).toMatchObject({ chatId: '@outro_canal' }); // não gravou

    tg.hits.length = 0;
    const off = await agent.patch(`/api/integrations/channels/${ch.id}`, { enabled: false });
    expect(off.json()).toMatchObject({ enabled: false, status: 'DISABLED' });
    expect(tg.hits).toHaveLength(0);
    expect(await prisma.auditLog.count({ where: { action: 'channel.update', entityId: ch.id } })).toBe(4); // as recusadas (409) não são auditadas
  });

  it('PATCH: corpo vazio => 400; campo desconhecido => 400; canal inexistente => 404; fila manual alterna CONNECTED/DISABLED', async () => {
    const manual = await seedManualChannel({ enabled: false, status: 'DISABLED' });
    expect((await agent.patch(`/api/integrations/channels/${manual.id}`, {})).statusCode).toBe(400);
    expect((await agent.patch(`/api/integrations/channels/${manual.id}`, { type: 'TELEGRAM' })).statusCode).toBe(400);
    expect((await agent.patch('/api/integrations/channels/nao-existe', { name: 'x' })).statusCode).toBe(404);
    expect((await agent.patch(`/api/integrations/channels/${manual.id}`, { enabled: true })).json()).toMatchObject({ enabled: true, status: 'CONNECTED' });
    expect((await agent.patch(`/api/integrations/channels/${manual.id}`, { enabled: false })).json()).toMatchObject({ enabled: false, status: 'DISABLED' });
  });

  it('DELETE: sem histórico remove; com publicações 409 CHANNEL_HAS_HISTORY; inexistente 404', async () => {
    const free = await seedManualChannel({ name: 'livre' });
    expect((await agent.delete(`/api/integrations/channels/${free.id}`)).json()).toEqual({ ok: true });
    expect(await prisma.publishingChannel.count()).toBe(0);

    const used = await seedManualChannel({ name: 'usado' });
    const s = await seedOffer();
    await seedPublication(s.offer, used, s.link, { status: 'MANUAL_READY' });
    const res = await agent.delete(`/api/integrations/channels/${used.id}`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CHANNEL_HAS_HISTORY');
    expect((await agent.delete('/api/integrations/channels/nao-existe')).statusCode).toBe(404);
    expect(await prisma.auditLog.count({ where: { action: 'channel.delete' } })).toBe(1);
  });

  it('ChannelDTO nunca expõe segredo: query string da URL do webhook é removida e a credencial aparece só como id', async () => {
    const wh = await seedCredential('webhook', { secret: WH_SECRET }, 'wh');
    await seedChannel('WEBHOOK', { name: 'wh', config: { url: 'https://hooks.exemplo.com/x?token=abcd1234efgh&secret=zzz' }, credentialId: wh.id });
    const ov = await agent.get('/api/integrations');
    const ch = ov.json().channels[0];
    expect(ch.config).toEqual({ url: 'https://hooks.exemplo.com/x' });
    expect(ch.credentialId).toBe(wh.id);
    expect(ov.body).not.toContain('abcd1234efgh');
    expect(leaks(ov.body)).toEqual([]);
  });
});

describe('teste de conexão do canal (sim)', () => {
  it('OK => {ok:true,status:CONNECTED,detail} e atualiza status/lastCheckedAt', async () => {
    const { id } = await tgCred();
    const ch = (await createTg({ credentialId: id })).json();
    const res = await agent.post(`/api/integrations/channels/${ch.id}/test`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, status: 'CONNECTED' });
    expect(res.json().detail).toContain('@achados_bot');
    const row = await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } });
    expect(row).toMatchObject({ status: 'CONNECTED' });
    expect(row.lastCheckedAt).toBeInstanceOf(Date);
    expect((await prisma.integrationCredential.findUniqueOrThrow({ where: { id } })).status).toBe('CONNECTED');
    expect(leaks(res.body)).toEqual([]);
  });

  it('token recusado => AUTH_REQUIRED + alerta; quando volta a funcionar o alerta é resolvido', async () => {
    const { id } = await tgCred();
    const ch = (await createTg({ credentialId: id, enabled: true })).json();
    tgMode = 'unauthorized';
    const bad = await agent.post(`/api/integrations/channels/${ch.id}/test`);
    expect(bad.json()).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
    expect((await prisma.publishingChannel.findUniqueOrThrow({ where: { id: ch.id } })).status).toBe('AUTH_REQUIRED');
    const note = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: `channel-auth:${ch.id}` } });
    expect(note).toMatchObject({ type: 'integration_auth_required', level: 'ERROR', readAt: null });
    tgMode = 'ok';
    expect((await agent.post(`/api/integrations/channels/${ch.id}/test`)).json()).toMatchObject({ ok: true, status: 'CONNECTED' });
    expect((await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: `channel-auth:${ch.id}` } })).readAt).not.toBeNull();
  });

  it('bot sem acesso ao chat (403 no getChat) => AUTH_REQUIRED; erro 500 => ERROR', async () => {
    const { id } = await tgCred();
    const ch = (await createTg({ credentialId: id })).json();
    tgMode = 'chat403';
    expect((await agent.post(`/api/integrations/channels/${ch.id}/test`)).json()).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
    tgMode = 'server-error';
    expect((await agent.post(`/api/integrations/channels/${ch.id}/test`)).json()).toMatchObject({ ok: false, status: 'ERROR' });
  });

  it('WhatsApp Cloud (sim): 200 => CONNECTED; 401 => AUTH_REQUIRED', async () => {
    const cred = (await agent.post('/api/integrations/credentials', { provider: 'whatsapp_cloud', name: 'Meta', values: { accessToken: WA_TOKEN } })).json();
    const ch = (await agent.post('/api/integrations/channels', { type: 'WHATSAPP_CLOUD_GROUP', name: 'WA', config: { phoneNumberId: '1234567890', groupId: 'g-1', baseUrl: wa.url }, credentialId: cred.id })).json();
    expect((await agent.post(`/api/integrations/channels/${ch.id}/test`)).json()).toMatchObject({ ok: true, status: 'CONNECTED' });
    waStatus = 401;
    const bad = await agent.post(`/api/integrations/channels/${ch.id}/test`);
    expect(bad.json()).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
    expect(leaks(bad.body)).toEqual([]);
  });

  it('fila manual: teste é local (CONNECTED) e sem rede; canal inexistente => 404', async () => {
    const manual = await seedManualChannel();
    expect((await agent.post(`/api/integrations/channels/${manual.id}/test`)).json()).toMatchObject({ ok: true, status: 'CONNECTED' });
    expect((await agent.post('/api/integrations/channels/nao-existe/test')).statusCode).toBe(404);
  });

  it('webhook já gravado com URL interna: o teste é recusado pela proteção SSRF (ERROR) sem conectar', async () => {
    setSsrfAllowPrivateForTests(false);
    try {
      const wh = await seedCredential('webhook', { secret: WH_SECRET }, 'wh');
      const ch = await seedChannel('WEBHOOK', { config: { url: tg.url + '/hook' }, credentialId: wh.id, status: 'UNKNOWN' });
      const res = await agent.post(`/api/integrations/channels/${ch.id}/test`);
      expect(res.json()).toMatchObject({ ok: false, status: 'ERROR' });
      expect(res.json().detail).toMatch(/SSRF/);
      expect(tg.hits).toHaveLength(0);
    } finally {
      setSsrfAllowPrivateForTests(true);
    }
  });
});

describe('visão geral (sim): modos A/B/C com status REAL', () => {
  const mode = (ov: any, key: string) => ov.modes.find((m: any) => m.key === key);

  it('sem canais: três modos "Não configurado" com explicação honesta', async () => {
    const ov = await overview();
    expect(ov.modes.map((m: any) => m.key)).toEqual(['A', 'B', 'C']);
    for (const m of ov.modes) {
      expect(m.status).toBe('NOT_CONFIGURED');
      expect(m.explanation).toMatch(/Nenhum canal cadastrado/);
    }
    expect(mode(ov, 'A').label).toMatch(/Groups API/);
    expect(mode(ov, 'A').explanation).toMatch(/grupos criados pela própria API/);
    expect(mode(ov, 'A').explanation).toMatch(/validar com credenciais reais/);
    expect(mode(ov, 'B').explanation).toMatch(/nunca registra envio sozinho/);
    expect(ov.channels).toEqual([]);
    expect(ov.credentials).toEqual([]);
  });

  it('o status de cada modo acompanha os canais: manual ativo => B conectado; Telegram testado => C conectado; WhatsApp com token recusado => A "Autenticação necessária"', async () => {
    await agent.post('/api/integrations/channels', { type: 'WHATSAPP_MANUAL_QUEUE', name: 'Fila', config: {}, enabled: true });
    let ov = await overview();
    expect(mode(ov, 'B')).toMatchObject({ status: 'CONNECTED' });
    expect(mode(ov, 'B').explanation).toMatch(/1 de 1 canal/);
    expect(mode(ov, 'A').status).toBe('NOT_CONFIGURED');
    expect(mode(ov, 'C').status).toBe('NOT_CONFIGURED');

    const { id } = await tgCred();
    const c = (await createTg({ credentialId: id })).json();
    ov = await overview();
    expect(mode(ov, 'C').status).toBe('NOT_CONFIGURED'); // cadastrado mas desabilitado/não testado não conta
    await agent.patch(`/api/integrations/channels/${c.id}`, { enabled: true });
    ov = await overview();
    expect(mode(ov, 'C')).toMatchObject({ status: 'CONNECTED' });
    expect(mode(ov, 'C').explanation).toMatch(/1 de 1 canal/);

    const cred = (await agent.post('/api/integrations/credentials', { provider: 'whatsapp_cloud', name: 'Meta', values: { accessToken: WA_TOKEN } })).json();
    const w = await seedChannel('WHATSAPP_CLOUD_GROUP', { enabled: true, status: 'UNKNOWN', config: { phoneNumberId: '1234567890', groupId: 'g-1', baseUrl: wa.url }, credentialId: cred.id });
    waStatus = 401;
    await agent.post(`/api/integrations/channels/${w.id}/test`);
    ov = await overview();
    expect(mode(ov, 'A').status).toBe('AUTH_REQUIRED');
    expect(ov.channels.find((x: any) => x.id === w.id)).toMatchObject({ status: 'AUTH_REQUIRED', automatic: true });
  });

  it('erro de configuração => ERROR; um conectado basta para o modo ficar CONNECTED; desabilitado nunca conta', async () => {
    await seedChannel('TELEGRAM', { enabled: true, status: 'ERROR', config: tgConfig() });
    expect(mode(await overview(), 'C').status).toBe('ERROR');
    await seedChannel('WEBHOOK', { enabled: true, status: 'CONNECTED', config: { url: 'https://hooks.exemplo.com/x' } });
    const ov = await overview();
    expect(mode(ov, 'C').status).toBe('CONNECTED');
    expect(mode(ov, 'C').explanation).toMatch(/1 de 2 canal/);
    await prisma.publishingChannel.updateMany({ where: { type: 'WEBHOOK' }, data: { enabled: false } });
    expect(mode(await overview(), 'C').status).toBe('ERROR');
    await prisma.publishingChannel.updateMany({ data: { enabled: false } });
    expect(mode(await overview(), 'C').status).toBe('NOT_CONFIGURED');
  });

  it('a fila manual do seed (status UNKNOWN) aparece como CONNECTED quando ativa — nada de "desconhecido"', async () => {
    const m = await seedManualChannel({ status: 'UNKNOWN' });
    const ov = await overview();
    expect(ov.channels.find((x: any) => x.id === m.id)).toMatchObject({ status: 'CONNECTED', automatic: false });
    expect(mode(ov, 'B').status).toBe('CONNECTED');
  });
});

describe('fonte de ofertas', () => {
  it('sem credenciais do Mercado Livre: NOT_CONFIGURED (nunca "conectado" por suposição); teste da fonte => AUTH_REQUIRED sem rede', async () => {
    const ov = await overview();
    expect(ov.source).toMatchObject({ name: 'Mercado Livre (API oficial)', status: 'NOT_CONFIGURED', simulated: false });
    const test = await agent.post('/api/integrations/source/test');
    expect(test.statusCode).toBe(200);
    expect(test.json()).toMatchObject({ ok: false, status: 'AUTH_REQUIRED' });
  });

  it('fonte "fixture" é rotulada como dados de TESTE (simulated=true) e o teste responde CONNECTED', async () => {
    await updateSettings({ monitoring: { source: 'fixture' } });
    const ov = await overview();
    expect(ov.source).toMatchObject({ status: 'CONNECTED', simulated: true });
    expect(ov.source.name).toMatch(/TESTE/);
    expect(ov.source.detail).toMatch(/NÃO são ofertas reais/);
    expect((await agent.post('/api/integrations/source/test')).json()).toMatchObject({ ok: true, status: 'CONNECTED' });
  });
});
