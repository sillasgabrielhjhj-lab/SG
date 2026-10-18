/**
 * Esquemas (zod) da configuração NÃO sensível de cada tipo de canal e das credenciais por provedor.
 * Configuração é strict: chaves desconhecidas (inclusive "token", "secret"...) são recusadas, para que
 * segredos nunca entrem em PublishingChannel.config. Segredos só existem em IntegrationCredential.
 */
import { z } from 'zod';
import type { ChannelType } from '@prisma/client';
import { env } from '../../lib/env.js';

export const OFFICIAL_HOSTS = { telegram: 'api.telegram.org', whatsapp: 'graph.facebook.com' } as const;

/**
 * baseUrl existe para simuladores locais (testes). Em PRODUÇÃO só vale o host oficial: caso contrário um
 * administrador (ou sessão sequestrada) apontaria o canal para um servidor próprio e capturaria o token.
 */
function baseUrlSchema(officialHost: string) {
  return z
    .url()
    .max(300)
    .refine(
      (v) => {
        if (!env.isProduction) return true;
        try {
          const u = new URL(v);
          return u.protocol === 'https:' && u.hostname === officialHost && !u.username && !u.password;
        } catch {
          return false;
        }
      },
      { message: `em produção, só https://${officialHost} é permitido` },
    )
    .optional();
}

const webhookUrl = z
  .url()
  .max(1000)
  .refine((v) => {
    try {
      const u = new URL(v);
      if (u.username || u.password) return false;
      return env.isProduction ? u.protocol === 'https:' : u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, { message: env.isProduction ? 'use uma URL https sem usuário/senha' : 'use uma URL http(s) sem usuário/senha' });

export const TelegramConfigSchema = z.strictObject({
  chatId: z
    .string()
    .trim()
    .regex(/^(@[A-Za-z][A-Za-z0-9_]{3,31}|-?\d{4,20})$/, 'use @nomedocanal ou o id numérico (ex.: -1001234567890)'),
  baseUrl: baseUrlSchema(OFFICIAL_HOSTS.telegram),
});

export const WhatsAppCloudConfigSchema = z.strictObject({
  phoneNumberId: z.string().trim().regex(/^\d{5,25}$/, 'o Phone Number ID é numérico'),
  /** ID do grupo CRIADO PELA API (Groups API). Grupos comuns do app não são alcançáveis. */
  groupId: z.string().trim().min(3).max(100),
  apiVersion: z.string().trim().regex(/^v\d{1,2}\.\d$/, 'ex.: v23.0').optional(),
  baseUrl: baseUrlSchema(OFFICIAL_HOSTS.whatsapp),
});

export const WebhookConfigSchema = z.strictObject({ url: webhookUrl });

export const ManualQueueConfigSchema = z.strictObject({ groupName: z.string().trim().max(100).optional() });

export const CHANNEL_CONFIG_SCHEMAS = {
  TELEGRAM: TelegramConfigSchema,
  WHATSAPP_CLOUD_GROUP: WhatsAppCloudConfigSchema,
  WEBHOOK: WebhookConfigSchema,
  WHATSAPP_MANUAL_QUEUE: ManualQueueConfigSchema,
} as const satisfies Record<ChannelType, z.ZodType>;

export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;
export type WhatsAppCloudConfig = z.infer<typeof WhatsAppCloudConfigSchema>;
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

export function configSchemaFor(type: ChannelType): z.ZodType {
  return CHANNEL_CONFIG_SCHEMAS[type];
}

/** Provedores de credencial aceitos e seus campos (write-only). */
export const CREDENTIAL_SCHEMAS = {
  telegram: z.strictObject({
    botToken: z.string().trim().regex(/^\d{6,}:[A-Za-z0-9_-]{20,}$/, 'formato inesperado (esperado 123456789:AA...)'),
  }),
  whatsapp_cloud: z.strictObject({ accessToken: z.string().trim().min(20).max(2000) }),
  webhook: z.strictObject({ secret: z.string().min(16, 'use ao menos 16 caracteres').max(256) }),
  mercadolivre: z.strictObject({
    clientId: z.string().trim().min(3).max(100),
    clientSecret: z.string().trim().min(8).max(300),
    refreshToken: z.string().trim().min(8).max(500).optional(),
  }),
} as const;

export type CredentialProvider = keyof typeof CREDENTIAL_SCHEMAS;
export const CREDENTIAL_PROVIDERS = Object.keys(CREDENTIAL_SCHEMAS) as CredentialProvider[];

/** Campo cujo final serve de "dica" (••••abcd) para identificar a credencial sem expô-la. */
export const CREDENTIAL_HINT_FIELD: Record<CredentialProvider, string> = {
  telegram: 'botToken',
  whatsapp_cloud: 'accessToken',
  webhook: 'secret',
  mercadolivre: 'clientSecret',
};

/** Provedor de credencial esperado por tipo de canal (null = não usa credencial). */
export const CHANNEL_CREDENTIAL_PROVIDER: Record<ChannelType, CredentialProvider | null> = {
  TELEGRAM: 'telegram',
  WHATSAPP_CLOUD_GROUP: 'whatsapp_cloud',
  WEBHOOK: 'webhook',
  WHATSAPP_MANUAL_QUEUE: null,
};
