import type { ChannelType } from './types';

/**
 * Campos dos formulários de integração. `config` guarda só dados NÃO sensíveis;
 * segredos vão para credenciais (write-only, criptografadas no servidor).
 * Centralizado aqui para ajustar facilmente os nomes de chave conforme os adaptadores do backend.
 */
export interface FieldDef {
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  /** Valida e devolve mensagem de erro (ou null). */
  validate?: (v: string) => string | null;
}

export const httpsUrl = (v: string): string | null => {
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return 'Use uma URL https.';
    if (u.username || u.password) return 'A URL não pode conter usuário/senha.';
    return null;
  } catch {
    return 'URL inválida.';
  }
};

export const CHANNEL_CONFIG_FIELDS: Record<ChannelType, FieldDef[]> = {
  WHATSAPP_CLOUD_GROUP: [
    { key: 'phoneNumberId', label: 'ID do número (Phone Number ID)', hint: 'Número da WhatsApp Business Platform.', required: true },
    { key: 'groupId', label: 'ID do grupo', hint: 'Grupo criado pela Groups API (não funciona com grupos comuns do app).', required: true },
  ],
  WHATSAPP_MANUAL_QUEUE: [],
  TELEGRAM: [{ key: 'chatId', label: 'Chat ID ou @canal', hint: 'Ex.: @meucanal ou -1001234567890. O bot precisa ser administrador.', required: true }],
  WEBHOOK: [{ key: 'url', label: 'URL do webhook (https)', placeholder: 'https://…', required: true, validate: httpsUrl }],
};

export interface CredentialProvider {
  id: string;
  label: string;
  fields: { key: string; label: string; hint?: string; secret?: boolean }[];
}

export const CREDENTIAL_PROVIDERS: Record<string, CredentialProvider> = {
  mercadolivre: {
    id: 'mercadolivre',
    label: 'Mercado Livre (app do DevCenter)',
    fields: [
      { key: 'clientId', label: 'App ID (client_id)' },
      { key: 'clientSecret', label: 'Chave secreta (client_secret)', secret: true },
    ],
  },
  whatsapp_cloud: {
    id: 'whatsapp_cloud',
    label: 'WhatsApp Business Platform',
    fields: [{ key: 'accessToken', label: 'Token de acesso (permanente)', secret: true }],
  },
  telegram: {
    id: 'telegram',
    label: 'Telegram Bot',
    fields: [{ key: 'botToken', label: 'Token do bot (do @BotFather)', secret: true }],
  },
  webhook: {
    id: 'webhook',
    label: 'Webhook (assinatura HMAC)',
    fields: [{ key: 'secret', label: 'Segredo de assinatura (HMAC)', hint: 'Usado para assinar o JSON enviado; valide-o no receptor.', secret: true }],
  },
};

/** Tipo de canal → provedor de credencial usado. */
export const CHANNEL_PROVIDER: Partial<Record<ChannelType, string>> = {
  WHATSAPP_CLOUD_GROUP: 'whatsapp_cloud',
  TELEGRAM: 'telegram',
  WEBHOOK: 'webhook',
};
