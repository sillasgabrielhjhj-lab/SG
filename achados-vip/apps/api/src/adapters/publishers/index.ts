/** Fábrica dos adaptadores de publicação. Config validada por zod; segredos só chegam via `credentials`. */
import type { ChannelType } from '@prisma/client';
import type { MessageFormat, PublisherAdapter } from '../../domain/types.js';
import { AdapterConfigError } from './common.js';
import { CHANNEL_CONFIG_SCHEMAS, CHANNEL_CREDENTIAL_PROVIDER, CREDENTIAL_SCHEMAS, type CredentialProvider } from './config.js';
import { ManualQueuePublisher } from './manual-queue.js';
import { TelegramPublisher } from './telegram.js';
import { WebhookPublisher } from './webhook.js';
import { WhatsAppCloudGroupPublisher } from './whatsapp-cloud.js';

export interface ChannelLike {
  type: ChannelType;
  config: unknown;
}

/** Valores já descriptografados da credencial (ex.: { botToken }). */
export type CredentialValues = Record<string, string>;

/** Formato de mensagem de cada tipo de canal (não exige credenciais; usado para pré-montar mensagens). */
export function channelFormat(type: ChannelType): MessageFormat {
  switch (type) {
    case 'TELEGRAM':
      return 'telegram_html';
    case 'WEBHOOK':
      return 'plain';
    default:
      return 'whatsapp';
  }
}

/** Canais que enviam sozinhos. A fila manual apenas prepara a mensagem (MANUAL_READY). */
export function isAutomaticChannel(type: ChannelType): boolean {
  return type !== 'WHATSAPP_MANUAL_QUEUE';
}

function parseConfig<T>(type: ChannelType, config: unknown): T {
  const r = CHANNEL_CONFIG_SCHEMAS[type].safeParse(config ?? {});
  if (!r.success) {
    const why = r.error.issues.map((i) => `${i.path.join('.') || 'config'}: ${i.message}`).join('; ');
    throw new AdapterConfigError(`Configuração do canal inválida (${why})`, 'config');
  }
  return r.data as T;
}

function parseCredentials<T>(provider: CredentialProvider, values: CredentialValues | null): T {
  if (!values) throw new AdapterConfigError('Credencial não configurada para este canal', 'credentials');
  const r = CREDENTIAL_SCHEMAS[provider].safeParse(values);
  if (!r.success) throw new AdapterConfigError('Credencial incompleta ou em formato inválido', 'credentials');
  return r.data as T;
}

/**
 * Cria o adaptador do canal. Lança AdapterConfigError se a configuração ou a credencial estiver ausente/inválida
 * (nunca inclui valores secretos na mensagem).
 */
export function createPublisher(channel: ChannelLike, credentials: CredentialValues | null): PublisherAdapter {
  switch (channel.type) {
    case 'WHATSAPP_MANUAL_QUEUE':
      parseConfig(channel.type, channel.config);
      return new ManualQueuePublisher();
    case 'TELEGRAM': {
      const cfg = parseConfig<{ chatId: string; baseUrl?: string }>(channel.type, channel.config);
      const cred = parseCredentials<{ botToken: string }>('telegram', credentials);
      return new TelegramPublisher({ botToken: cred.botToken, chatId: cfg.chatId, ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}) });
    }
    case 'WHATSAPP_CLOUD_GROUP': {
      const cfg = parseConfig<{ phoneNumberId: string; groupId: string; apiVersion?: string; baseUrl?: string }>(channel.type, channel.config);
      const cred = parseCredentials<{ accessToken: string }>('whatsapp_cloud', credentials);
      return new WhatsAppCloudGroupPublisher({
        accessToken: cred.accessToken,
        phoneNumberId: cfg.phoneNumberId,
        groupId: cfg.groupId,
        ...(cfg.apiVersion ? { apiVersion: cfg.apiVersion } : {}),
        ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
      });
    }
    case 'WEBHOOK': {
      const cfg = parseConfig<{ url: string }>(channel.type, channel.config);
      const cred = parseCredentials<{ secret: string }>('webhook', credentials);
      return new WebhookPublisher({ url: cfg.url, secret: cred.secret });
    }
  }
}

export { AdapterConfigError, CHANNEL_CREDENTIAL_PROVIDER, ManualQueuePublisher, TelegramPublisher, WebhookPublisher, WhatsAppCloudGroupPublisher };
