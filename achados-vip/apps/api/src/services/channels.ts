/**
 * Canais de publicação, credenciais (write-only), testes de conexão e visão geral das integrações (modos A/B/C).
 * - Credenciais: validadas por provedor, criptografadas (AES-256-GCM) e NUNCA devolvidas; a API só expõe `hint`.
 * - Canais automáticos só são ativados após um teste de conexão REAL bem-sucedido.
 * - O status exibido é derivado do último teste/envio real; nada é "conectado" por suposição.
 */
import type { ChannelStatus, ChannelType, IntegrationCredential, Prisma, PublishingChannel } from '@prisma/client';
import { createPublisher, isAutomaticChannel, AdapterConfigError, type CredentialValues } from '../adapters/index.js';
import { hasMlCredentials } from '../adapters/sources/credentials.js';
import { cleanError, redactKnownSecrets } from '../adapters/publishers/common.js';
import {
  CHANNEL_CREDENTIAL_PROVIDER,
  CREDENTIAL_HINT_FIELD,
  CREDENTIAL_PROVIDERS,
  CREDENTIAL_SCHEMAS,
  configSchemaFor,
  type CredentialProvider,
} from '../adapters/publishers/config.js';
import type { HealthResult } from '../domain/types.js';
import { decryptJson, encryptJson, secretHint } from '../lib/crypto.js';
import { prisma } from '../lib/db.js';
import { ConflictError, NotFoundError, ValidationError, formatZodIssues } from '../lib/errors.js';
import { redactUrl } from '../lib/http.js';
import { isSensitiveKey } from '../lib/logger.js';
import { assertSafeUrl, SsrfBlockedError } from '../lib/ssrf.js';
import { withTimeout } from '../lib/time.js';
import { recordAudit } from './audit.js';
import { testSourceConnection } from './discovery.js';
import { logEvent } from './logs.js';
import { notify, resolveByKey } from './notifications.js';
import { getSettings } from './settings.js';

const HEALTH_DEADLINE_MS = 30_000;

// ---------- DTOs ----------

export interface ChannelDTO {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  credentialId: string | null;
  status: ChannelStatus;
  statusDetail: string | null;
  lastCheckedAt: string | null;
  automatic: boolean;
}

export interface CredentialDTO {
  id: string;
  provider: string;
  name: string;
  hint: string | null;
  status: string;
}

export type IntegrationStatus = 'CONNECTED' | 'ERROR' | 'AUTH_REQUIRED' | 'NOT_CONFIGURED';

export interface ModeDTO {
  key: 'A' | 'B' | 'C';
  label: string;
  status: IntegrationStatus;
  explanation: string;
}

export interface SourceStatusDTO {
  name: string;
  status: IntegrationStatus | 'UNKNOWN';
  detail: string;
  lastCheckedAt: string | null;
  /** true => dados de demonstração (fonte "fixture"), não são ofertas reais. */
  simulated: boolean;
}

export interface TestResultDTO {
  ok: boolean;
  status: ChannelStatus;
  detail: string;
}

/** Remove segredos eventuais e query string/fragmento de URLs (tokens costumam vir no caminho/consulta). */
function publicConfig(config: unknown): Record<string, unknown> {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
    if (isSensitiveKey(k)) out[k] = '[REDACTED]';
    else out[k] = k.toLowerCase().endsWith('url') && typeof v === 'string' ? redactUrl(v) : v;
  }
  return out;
}

export function toChannelDTO(c: PublishingChannel): ChannelDTO {
  const automatic = isAutomaticChannel(c.type);
  // A fila manual não tem o que conectar: ativa => pronta (o seed a cria com status UNKNOWN)
  const manualReady = !automatic && c.enabled;
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    enabled: c.enabled,
    config: publicConfig(c.config),
    credentialId: c.credentialId,
    status: manualReady ? 'CONNECTED' : c.status,
    statusDetail: manualReady ? 'Fila manual ativa (não depende de integração externa)' : c.statusDetail,
    lastCheckedAt: c.lastCheckedAt?.toISOString() ?? null,
    automatic,
  };
}

const toCredentialDTO = (c: Pick<IntegrationCredential, 'id' | 'provider' | 'name' | 'hint' | 'status'>): CredentialDTO => ({
  id: c.id,
  provider: c.provider,
  name: c.name,
  hint: c.hint,
  status: c.status,
});

// ---------- credenciais (write-only) ----------

export async function listCredentials(): Promise<CredentialDTO[]> {
  const rows = await prisma.integrationCredential.findMany({ orderBy: [{ provider: 'asc' }, { name: 'asc' }] });
  return rows.map(toCredentialDTO);
}

/** Valores descriptografados (uso interno dos adaptadores). null se não existir ou estiver ilegível. */
export async function loadCredentialValues(credentialId: string | null): Promise<CredentialValues | null> {
  if (!credentialId) return null;
  const row = await prisma.integrationCredential.findUnique({ where: { id: credentialId }, select: { encrypted: true } });
  if (!row) return null;
  try {
    const values = decryptJson<Record<string, unknown>>(row.encrypted);
    return Object.fromEntries(Object.entries(values).filter(([, v]) => typeof v === 'string')) as CredentialValues;
  } catch {
    return null; // chave trocada/dado corrompido: tratado como credencial ausente
  }
}

/**
 * Cria ou SUBSTITUI (mesmo provedor + nome) uma credencial. Devolve apenas id/provedor/nome/hint.
 * Canais que usam a credencial voltam a "não testado" (o novo segredo precisa ser verificado).
 */
export async function saveCredential(
  input: { provider: string; name: string; values: unknown },
  userId?: string | null,
  ip?: string | null,
): Promise<CredentialDTO> {
  const provider = input.provider as CredentialProvider;
  if (!CREDENTIAL_PROVIDERS.includes(provider)) {
    throw new ValidationError('Provedor de credencial não suportado.', [{ path: 'provider', message: `use um destes: ${CREDENTIAL_PROVIDERS.join(', ')}` }]);
  }
  const parsed = CREDENTIAL_SCHEMAS[provider].safeParse(input.values);
  if (!parsed.success) {
    // formatZodIssues não ecoa os valores recebidos (só caminhos e mensagens)
    throw new ValidationError(
      'Credencial inválida.',
      formatZodIssues(parsed.error).map((i) => ({ ...i, path: `values.${i.path}` })),
    );
  }
  const values = parsed.data as Record<string, string | undefined>;
  const hint = secretHint(String(values[CREDENTIAL_HINT_FIELD[provider]] ?? ''));
  const encrypted = encryptJson(values);
  const name = input.name.trim();

  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.integrationCredential.upsert({
      where: { provider_name: { provider, name } },
      create: { provider, name, encrypted, hint, status: 'UNKNOWN' },
      update: { encrypted, hint, status: 'UNKNOWN' },
    });
    await tx.publishingChannel.updateMany({
      where: { credentialId: saved.id },
      data: { status: 'UNKNOWN', statusDetail: 'Credencial atualizada: teste a conexão novamente', lastCheckedAt: null },
    });
    await recordAudit({ userId: userId ?? null, action: 'credential.save', entity: 'IntegrationCredential', entityId: saved.id, after: { provider, name, hint }, ip: ip ?? null }, tx);
    return saved;
  });
  // canais pausados por autenticação voltam a poder tentar (o próximo envio/teste revalida)
  const channels = await prisma.publishingChannel.findMany({ where: { credentialId: row.id }, select: { id: true } });
  await Promise.all(channels.map((c) => resolveByKey(`channel-auth:${c.id}`)));
  return toCredentialDTO(row);
}

export async function deleteCredential(id: string, userId?: string | null, ip?: string | null): Promise<void> {
  const row = await prisma.integrationCredential.findUnique({ where: { id }, include: { _count: { select: { channels: true } } } });
  if (!row) throw new NotFoundError('Credencial não encontrada.');
  if (row._count.channels > 0) {
    throw new ConflictError('Esta credencial está em uso por um canal. Troque ou remova o canal antes.', 'CREDENTIAL_IN_USE');
  }
  await prisma.integrationCredential.delete({ where: { id } });
  await recordAudit({ userId: userId ?? null, action: 'credential.delete', entity: 'IntegrationCredential', entityId: id, before: { provider: row.provider, name: row.name }, ip: ip ?? null });
}

// ---------- validação de canais ----------

function parseChannelConfig(type: ChannelType, config: unknown): Record<string, unknown> {
  const r = configSchemaFor(type).safeParse(config ?? {});
  if (!r.success) {
    throw new ValidationError(
      'Configuração do canal inválida.',
      formatZodIssues(r.error).map((i) => ({ ...i, path: i.path ? `config.${i.path}` : 'config' })),
    );
  }
  return r.data as Record<string, unknown>;
}

async function assertCredentialFits(type: ChannelType, credentialId: string | null | undefined): Promise<void> {
  const expected = CHANNEL_CREDENTIAL_PROVIDER[type];
  if (!credentialId) return;
  if (!expected) throw new ValidationError('Este tipo de canal não usa credencial.', [{ path: 'credentialId', message: 'não aplicável' }]);
  const cred = await prisma.integrationCredential.findUnique({ where: { id: credentialId }, select: { provider: true } });
  if (!cred) throw new ValidationError('Credencial não encontrada.', [{ path: 'credentialId', message: 'inexistente' }]);
  if (cred.provider !== expected) {
    throw new ValidationError('A credencial não é do provedor esperado para este canal.', [{ path: 'credentialId', message: `esperado: ${expected}` }]);
  }
}

/** Webhook: a URL precisa passar pela proteção SSRF (rede interna/IP privado recusados). */
async function assertWebhookUrlSafe(type: ChannelType, config: Record<string, unknown>): Promise<void> {
  if (type !== 'WEBHOOK') return;
  try {
    await assertSafeUrl(String(config.url));
  } catch (err) {
    const why = err instanceof SsrfBlockedError ? err.message : cleanError(err);
    throw new ValidationError('URL do webhook não permitida.', [{ path: 'config.url', message: why }]);
  }
}

// ---------- saúde ----------

/** Teste de conexão REAL a partir de config + credencial (sem exigir que o canal já exista). */
export async function runHealth(type: ChannelType, config: unknown, credentialId: string | null): Promise<HealthResult> {
  const provider = CHANNEL_CREDENTIAL_PROVIDER[type];
  const values = provider ? await loadCredentialValues(credentialId) : null;
  if (provider && !values) return { ok: false, status: 'AUTH_REQUIRED', detail: 'Credencial não configurada (ou ilegível) para este canal' };
  const secrets = Object.values(values ?? {});
  try {
    const adapter = createPublisher({ type, config }, values);
    return redactKnownSecrets(await withTimeout(adapter.healthCheck(), HEALTH_DEADLINE_MS, 'teste de conexão'), secrets);
  } catch (err) {
    if (err instanceof AdapterConfigError) return { ok: false, status: err.kind === 'credentials' ? 'AUTH_REQUIRED' : 'ERROR', detail: err.message };
    return { ok: false, status: 'ERROR', detail: redactKnownSecrets(cleanError(err), secrets) };
  }
}

/**
 * O teste de conexão (ex.: Telegram getMe) pode dar OK mesmo com o envio sendo recusado (bot removido do canal, 403).
 * Se a tentativa de envio MAIS RECENTE do canal foi recusada (401/403) e nenhum envio posterior deu certo,
 * o canal não é considerado conectado.
 */
export async function applySendHistory(channelId: string, r: HealthResult): Promise<HealthResult> {
  if (r.status !== 'CONNECTED') return r;
  const last = await prisma.publicationAttempt.findFirst({
    where: { publication: { channelId } },
    orderBy: { startedAt: 'desc' },
    select: { success: true, httpStatus: true, startedAt: true },
  });
  if (!last || last.success || (last.httpStatus !== 401 && last.httpStatus !== 403)) return r;
  return {
    ok: false,
    status: 'AUTH_REQUIRED',
    detail: `A conexão responde, mas o último envio foi recusado (HTTP ${last.httpStatus}) em ${last.startedAt.toISOString()}. Verifique permissões do bot/token e envie uma publicação de teste.`,
  };
}

/** Grava o resultado de um teste/health e emite (ou resolve) alertas deduplicados. */
export async function applyChannelHealth(channel: PublishingChannel, r: HealthResult, now = new Date()): Promise<void> {
  await prisma.publishingChannel.update({
    where: { id: channel.id },
    data: { status: r.status, statusDetail: cleanError(r.detail, 500), lastCheckedAt: now },
  });
  if (channel.credentialId) {
    await prisma.integrationCredential.updateMany({ where: { id: channel.credentialId }, data: { status: r.status } });
  }
  if (r.status === 'CONNECTED') {
    await Promise.all([resolveByKey(`channel-auth:${channel.id}`), resolveByKey(`channel-error:${channel.id}`)]);
    return;
  }
  if (!channel.enabled) return; // canal desligado falhando não precisa de alerta
  if (r.status === 'AUTH_REQUIRED') {
    await notify({ level: 'ERROR', type: 'integration_auth_required', title: `Canal "${channel.name}": autenticação necessária`, body: r.detail, dedupeKey: `channel-auth:${channel.id}` });
  } else {
    await notify({ level: 'WARN', type: 'integration_error', title: `Canal "${channel.name}" com erro`, body: r.detail, dedupeKey: `channel-error:${channel.id}` });
  }
}

export async function testChannel(id: string): Promise<TestResultDTO> {
  const channel = await prisma.publishingChannel.findUnique({ where: { id } });
  if (!channel) throw new NotFoundError('Canal não encontrado.');
  let result: HealthResult;
  if (!isAutomaticChannel(channel.type)) {
    result = { ok: true, status: 'CONNECTED', detail: 'Fila manual ativa (não depende de integração externa)' };
  } else {
    try {
      await assertWebhookUrlSafe(channel.type, (channel.config ?? {}) as Record<string, unknown>);
      result = await applySendHistory(channel.id, await runHealth(channel.type, channel.config, channel.credentialId));
    } catch (err) {
      result = { ok: false, status: 'ERROR', detail: err instanceof ValidationError ? 'URL do webhook recusada pela proteção SSRF' : cleanError(err) };
    }
  }
  await applyChannelHealth(channel, result);
  await logEvent(result.ok ? 'INFO' : 'WARN', 'integrations', `Teste de conexão do canal "${channel.name}": ${result.status}`, { channelId: id, type: channel.type, detail: result.detail });
  return { ok: result.ok, status: result.status, detail: cleanError(result.detail, 500) };
}

// ---------- CRUD de canais ----------

export async function listChannels(): Promise<ChannelDTO[]> {
  const rows = await prisma.publishingChannel.findMany({ orderBy: [{ createdAt: 'asc' }] });
  return rows.map(toChannelDTO);
}

export async function getChannelDTO(id: string): Promise<ChannelDTO> {
  const row = await prisma.publishingChannel.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('Canal não encontrado.');
  return toChannelDTO(row);
}

async function requireConnected(type: ChannelType, config: unknown, credentialId: string | null): Promise<HealthResult> {
  const r = await runHealth(type, config, credentialId);
  if (!r.ok || r.status !== 'CONNECTED') {
    throw new ConflictError(`Não foi possível ativar o canal: ${r.detail}. Corrija e teste a conexão antes de ativar.`, 'CHANNEL_NOT_CONNECTED', { status: r.status, detail: r.detail });
  }
  return r;
}

export interface CreateChannelInput {
  type: ChannelType;
  name: string;
  config: unknown;
  credentialId?: string | null;
  enabled?: boolean;
}

export async function createChannel(input: CreateChannelInput, userId?: string | null, ip?: string | null): Promise<ChannelDTO> {
  const config = parseChannelConfig(input.type, input.config);
  await assertCredentialFits(input.type, input.credentialId);
  await assertWebhookUrlSafe(input.type, config);
  const automatic = isAutomaticChannel(input.type);
  const credentialId = input.credentialId ?? null;

  let status: ChannelStatus = 'UNKNOWN';
  let detail: string | null = automatic ? 'Ainda não testado: use "Testar conexão"' : 'Fila manual (não depende de integração externa)';
  let checkedAt: Date | null = null;
  const wantsEnabled = input.enabled ?? false;
  if (wantsEnabled && automatic) {
    const h = await requireConnected(input.type, config, credentialId);
    status = h.status;
    detail = h.detail;
    checkedAt = new Date();
  } else if (!automatic) {
    status = wantsEnabled ? 'CONNECTED' : 'DISABLED';
  }

  const row = await prisma.publishingChannel.create({
    data: {
      type: input.type,
      name: input.name.trim(),
      enabled: wantsEnabled,
      config: config as Prisma.InputJsonValue,
      credentialId,
      status,
      statusDetail: detail ? cleanError(detail, 500) : null,
      lastCheckedAt: checkedAt,
    },
  });
  await recordAudit({ userId: userId ?? null, action: 'channel.create', entity: 'PublishingChannel', entityId: row.id, after: toChannelDTO(row), ip: ip ?? null });
  return toChannelDTO(row);
}

export interface UpdateChannelInput {
  name?: string;
  config?: unknown;
  credentialId?: string | null;
  enabled?: boolean;
}

export async function updateChannel(id: string, patch: UpdateChannelInput, userId?: string | null, ip?: string | null): Promise<ChannelDTO> {
  const before = await prisma.publishingChannel.findUnique({ where: { id } });
  if (!before) throw new NotFoundError('Canal não encontrado.');
  const automatic = isAutomaticChannel(before.type);

  const config = patch.config !== undefined ? parseChannelConfig(before.type, patch.config) : ((before.config ?? {}) as Record<string, unknown>);
  const credentialId = patch.credentialId !== undefined ? patch.credentialId : before.credentialId;
  const enabled = patch.enabled ?? before.enabled;
  if (patch.config !== undefined) await assertWebhookUrlSafe(before.type, config);
  if (patch.credentialId !== undefined) await assertCredentialFits(before.type, credentialId);

  const connectionChanged = patch.config !== undefined || patch.credentialId !== undefined;
  const data: Prisma.PublishingChannelUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.config !== undefined) data.config = config as Prisma.InputJsonValue;
  if (patch.credentialId !== undefined) data.credential = credentialId ? { connect: { id: credentialId } } : { disconnect: true };
  data.enabled = enabled;

  if (!automatic) {
    data.status = enabled ? 'CONNECTED' : 'DISABLED';
    data.statusDetail = enabled ? 'Fila manual ativa (não depende de integração externa)' : 'Canal desativado';
  } else if (!enabled) {
    data.status = 'DISABLED';
    data.statusDetail = 'Canal desativado';
  } else if (!before.enabled || connectionChanged) {
    // ativar (ou mudar conexão de um canal ativo) exige teste real bem-sucedido
    const h = await requireConnected(before.type, config, credentialId);
    data.status = h.status;
    data.statusDetail = cleanError(h.detail, 500);
    data.lastCheckedAt = new Date();
  }

  const row = await prisma.publishingChannel.update({ where: { id }, data });
  if (enabled && row.status === 'CONNECTED') await Promise.all([resolveByKey(`channel-auth:${id}`), resolveByKey(`channel-error:${id}`)]);
  await recordAudit({ userId: userId ?? null, action: 'channel.update', entity: 'PublishingChannel', entityId: id, before: toChannelDTO(before), after: toChannelDTO(row), ip: ip ?? null });
  return toChannelDTO(row);
}

export async function deleteChannel(id: string, userId?: string | null, ip?: string | null): Promise<void> {
  const row = await prisma.publishingChannel.findUnique({ where: { id }, include: { _count: { select: { publications: true } } } });
  if (!row) throw new NotFoundError('Canal não encontrado.');
  if (row._count.publications > 0) {
    throw new ConflictError('O canal tem histórico de publicações e não pode ser excluído. Desative-o.', 'CHANNEL_HAS_HISTORY');
  }
  await prisma.publishingChannel.delete({ where: { id } });
  await recordAudit({ userId: userId ?? null, action: 'channel.delete', entity: 'PublishingChannel', entityId: id, before: toChannelDTO(row), ip: ip ?? null });
}

/** Mantém o status da fila manual coerente (o seed cria o canal com status UNKNOWN). */
export async function syncManualChannelStatus(): Promise<void> {
  await prisma.publishingChannel.updateMany({
    where: { type: 'WHATSAPP_MANUAL_QUEUE', enabled: true, status: { not: 'CONNECTED' } },
    data: { status: 'CONNECTED', statusDetail: 'Fila manual ativa (não depende de integração externa)' },
  });
  await prisma.publishingChannel.updateMany({
    where: { type: 'WHATSAPP_MANUAL_QUEUE', enabled: false, status: { not: 'DISABLED' } },
    data: { status: 'DISABLED', statusDetail: 'Canal desativado' },
  });
}

// ---------- fonte de ofertas ----------

/**
 * Status da fonte, derivado do último teste/coleta REAL (mesmas regras do dashboard): status gravado na credencial do
 * Mercado Livre por testSourceConnection/runDiscovery; sem isso, o resultado do último job de descoberta.
 */
export async function getSourceStatus(): Promise<SourceStatusDTO> {
  const settings = await getSettings();
  if (settings.monitoring.source === 'fixture') {
    return {
      name: 'Fixture (dados de TESTE)',
      status: 'CONNECTED',
      detail: 'Fonte de teste: os dados NÃO são ofertas reais e não devem ser publicados.',
      lastCheckedAt: null,
      simulated: true,
    };
  }
  const name = 'Mercado Livre (API oficial)';
  if (!(await hasMlCredentials())) {
    return { name, status: 'NOT_CONFIGURED', detail: 'Credenciais do Mercado Livre não configuradas. Cadastre-as em Integrações.', lastCheckedAt: null, simulated: false };
  }
  const [cred, job] = await Promise.all([
    prisma.integrationCredential.findFirst({ where: { provider: 'mercadolivre' }, orderBy: { updatedAt: 'desc' }, select: { status: true, updatedAt: true } }),
    prisma.scheduledJob.findUnique({ where: { name: 'discovery' }, select: { status: true, lastError: true, lastSuccessAt: true, lastRunAt: true } }),
  ]);
  let status: SourceStatusDTO['status'] = 'UNKNOWN';
  if (cred?.status && cred.status !== 'UNKNOWN') status = cred.status as IntegrationStatus;
  else if (job) status = job.status === 'FAILED' ? 'ERROR' : job.lastSuccessAt ? 'CONNECTED' : 'UNKNOWN';
  const detail =
    status === 'CONNECTED'
      ? job?.lastSuccessAt
        ? `Última coleta bem-sucedida em ${job.lastSuccessAt.toISOString()}.`
        : 'Conexão testada com sucesso.'
      : status === 'UNKNOWN'
        ? 'Credenciais presentes, mas a conexão ainda não foi testada.'
        : (job?.lastError ?? 'Sem detalhes. Use "Testar fonte" em Integrações.');
  return { name, status, detail, lastCheckedAt: job?.lastRunAt?.toISOString() ?? null, simulated: false };
}

/** Testa a fonte configurada (healthCheck real) e atualiza status/alertas via serviço de descoberta. */
export async function testSource(): Promise<{ ok: boolean; status: IntegrationStatus; detail: string }> {
  let health: HealthResult;
  try {
    health = await withTimeout(testSourceConnection(), HEALTH_DEADLINE_MS, 'teste da fonte');
  } catch (err) {
    health = { ok: false, status: 'ERROR', detail: cleanError(err) };
  }
  return { ok: health.ok, status: health.status, detail: cleanError(health.detail, 500) };
}

// ---------- visão geral (modos A/B/C) ----------

function effective(c: PublishingChannel): IntegrationStatus {
  if (!c.enabled) return 'NOT_CONFIGURED';
  if (!isAutomaticChannel(c.type)) return 'CONNECTED';
  switch (c.status) {
    case 'CONNECTED':
      return 'CONNECTED';
    case 'AUTH_REQUIRED':
      return 'AUTH_REQUIRED';
    case 'ERROR':
      return 'ERROR';
    default:
      return 'NOT_CONFIGURED';
  }
}

function aggregate(channels: PublishingChannel[]): { status: IntegrationStatus; connected: number; total: number } {
  const states = channels.map(effective);
  const connected = states.filter((s) => s === 'CONNECTED').length;
  const status: IntegrationStatus = connected > 0 ? 'CONNECTED' : states.includes('AUTH_REQUIRED') ? 'AUTH_REQUIRED' : states.includes('ERROR') ? 'ERROR' : 'NOT_CONFIGURED';
  return { status, connected, total: channels.length };
}

export function buildModes(channels: PublishingChannel[]): ModeDTO[] {
  const a = aggregate(channels.filter((c) => c.type === 'WHATSAPP_CLOUD_GROUP'));
  const b = aggregate(channels.filter((c) => c.type === 'WHATSAPP_MANUAL_QUEUE'));
  const c = aggregate(channels.filter((x) => x.type === 'TELEGRAM' || x.type === 'WEBHOOK'));
  const counts = (m: { connected: number; total: number }) => (m.total === 0 ? 'Nenhum canal cadastrado.' : `${m.connected} de ${m.total} canal(is) conectado(s) e ativo(s).`);
  return [
    {
      key: 'A',
      label: 'Modo A — WhatsApp Business Platform (Groups API oficial)',
      status: a.status,
      explanation: `Publica automaticamente apenas em grupos criados pela própria API da Meta (máx. 8 participantes, entrada por link de convite); não alcança grupos comuns do WhatsApp. Ainda a validar com credenciais reais. ${counts(a)}`,
    },
    {
      key: 'B',
      label: 'Modo B — Fila manual (WhatsApp)',
      status: b.status,
      explanation: `Entrega mensagem e imagem prontas para você publicar no grupo e marcar como publicada. Não depende de integração externa e nunca registra envio sozinho. ${counts(b)}`,
    },
    {
      key: 'C',
      label: 'Modo C — Telegram e webhook assinado',
      status: c.status,
      explanation: `Automação total via Bot API oficial do Telegram e/ou webhook assinado (HMAC) para um serviço seu. O status só é "Conectado" após um teste real. ${counts(c)}`,
    },
  ];
}

export async function getIntegrationsOverview(): Promise<{ source: SourceStatusDTO; channels: ChannelDTO[]; credentials: CredentialDTO[]; modes: ModeDTO[] }> {
  const [source, rows, credentials] = await Promise.all([
    getSourceStatus(),
    prisma.publishingChannel.findMany({ orderBy: [{ createdAt: 'asc' }] }),
    listCredentials(),
  ]);
  return { source, channels: rows.map(toChannelDTO), credentials, modes: buildModes(rows) };
}
