/**
 * Credenciais do Mercado Livre: IntegrationCredential (provider "mercadolivre", AES-256-GCM) com fallback para o ambiente
 * (ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REFRESH_TOKEN). Nunca logar os valores.
 *
 * Chaves aceitas em `values` (qualquer caixa/separador): clientId | client_id, clientSecret | client_secret, refreshToken | refresh_token.
 * O refresh_token do ML é rotacionado a cada renovação: o novo é gravado de volta na credencial do banco
 * (se a origem era o ambiente, cria a credencial "Renovada automaticamente", que passa a ter prioridade sobre o .env).
 */
import { prisma } from '../../lib/db.js';
import { decryptJson, encryptJson } from '../../lib/crypto.js';
import { env } from '../../lib/env.js';
import type { Prisma } from '@prisma/client';
import type { MlCredentials } from './mercadolivre.js';

export const ML_PROVIDER = 'mercadolivre';
const AUTO_NAME = 'Renovada automaticamente';

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
const NAME_MAP: Record<keyof MlCredentials, string[]> = {
  clientId: ['clientid', 'mlclientid'],
  clientSecret: ['clientsecret', 'mlclientsecret'],
  refreshToken: ['refreshtoken', 'mlrefreshtoken'],
};

/** Extrai as 3 credenciais de um objeto de valores (nomes tolerantes). null se faltar alguma. */
export function pickCredentials(values: unknown): MlCredentials | null {
  if (typeof values !== 'object' || values === null) return null;
  const flat = new Map<string, string>();
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) flat.set(norm(k), v.trim());
  }
  const get = (field: keyof MlCredentials) => NAME_MAP[field].map((n) => flat.get(n)).find(Boolean);
  const clientId = get('clientId');
  const clientSecret = get('clientSecret');
  const refreshToken = get('refreshToken');
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null;
}

export async function loadMlCredentials(): Promise<MlCredentials | null> {
  const rows = await prisma.integrationCredential.findMany({ where: { provider: ML_PROVIDER }, orderBy: { updatedAt: 'desc' } });
  for (const row of rows) {
    try {
      const creds = pickCredentials(decryptJson(row.encrypted));
      if (creds) return creds;
    } catch {
      // credencial ilegível (chave trocada/corrompida): tenta a próxima / o ambiente
    }
  }
  if (env.ML_CLIENT_ID && env.ML_CLIENT_SECRET && env.ML_REFRESH_TOKEN) {
    return { clientId: env.ML_CLIENT_ID, clientSecret: env.ML_CLIENT_SECRET, refreshToken: env.ML_REFRESH_TOKEN };
  }
  return null;
}

/** True se há credencial (banco ou ambiente) — sem decifrar nada além do necessário. */
export async function hasMlCredentials(): Promise<boolean> {
  return (await loadMlCredentials()) !== null;
}

/** Persiste o refresh_token novo (rotação). */
export async function saveRotatedCredentials(next: MlCredentials): Promise<void> {
  const rows = await prisma.integrationCredential.findMany({ where: { provider: ML_PROVIDER }, orderBy: { updatedAt: 'desc' } });
  for (const row of rows) {
    try {
      const values = decryptJson<Record<string, unknown>>(row.encrypted);
      const current = pickCredentials(values);
      if (!current || current.clientId !== next.clientId) continue;
      const key = Object.keys(values).find((k) => NAME_MAP.refreshToken.includes(norm(k))) ?? 'refreshToken';
      await prisma.integrationCredential.update({ where: { id: row.id }, data: { encrypted: encryptJson({ ...values, [key]: next.refreshToken }) } });
      return;
    } catch {
      // tenta a próxima
    }
  }
  const encrypted = encryptJson({ clientId: next.clientId, clientSecret: next.clientSecret, refreshToken: next.refreshToken });
  const hint = `…${next.clientId.slice(-4)}`;
  await prisma.integrationCredential.upsert({
    where: { provider_name: { provider: ML_PROVIDER, name: AUTO_NAME } },
    update: { encrypted, hint },
    create: { provider: ML_PROVIDER, name: AUTO_NAME, encrypted, hint, status: 'CONNECTED' },
  });
}

/** Atualiza o status das credenciais do ML (UNKNOWN | CONNECTED | ERROR | AUTH_REQUIRED). */
export async function setMlCredentialStatus(status: string, client: Pick<Prisma.TransactionClient, 'integrationCredential'> = prisma): Promise<void> {
  await client.integrationCredential.updateMany({ where: { provider: ML_PROVIDER }, data: { status } });
}
