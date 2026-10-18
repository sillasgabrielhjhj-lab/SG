import type { ChannelType, OfferKind, OfferStatus, OfferTier, PublicationStatus, WeightKey } from './types';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
export interface Labeled {
  label: string;
  tone: Tone;
}

/** Status de integração/canal/fonte — rótulos honestos (só "Conectado" após teste real bem-sucedido). */
export function integrationStatus(status: string | null | undefined, enabled = true): Labeled {
  if (!enabled) return { label: 'Desativado', tone: 'neutral' };
  switch (status) {
    case 'CONNECTED':
      return { label: 'Conectado', tone: 'success' };
    case 'ERROR':
      return { label: 'Erro', tone: 'danger' };
    case 'AUTH_REQUIRED':
      return { label: 'Autenticação necessária', tone: 'warning' };
    case 'NOT_CONFIGURED':
      return { label: 'Não configurado', tone: 'neutral' };
    case 'DISABLED':
      return { label: 'Desativado', tone: 'neutral' };
    case 'UNKNOWN':
    case undefined:
    case null:
      return { label: 'Não verificado', tone: 'neutral' };
    default:
      return { label: String(status), tone: 'neutral' };
  }
}

export const OFFER_STATUS: Record<OfferStatus, Labeled> = {
  DISCOVERED: { label: 'Descoberta', tone: 'info' },
  APPROVED: { label: 'Aprovada', tone: 'success' },
  REJECTED: { label: 'Descartada', tone: 'neutral' },
  QUEUED: { label: 'Na fila', tone: 'primary' },
  PUBLISHED: { label: 'Publicada', tone: 'success' },
  EXPIRED: { label: 'Expirada', tone: 'neutral' },
  SUSPENDED: { label: 'Suspensa', tone: 'warning' },
};

export const OFFER_TIER: Record<OfferTier, Labeled> = {
  EXCEPTIONAL: { label: 'Excepcional', tone: 'success' },
  EXCELLENT: { label: 'Excelente', tone: 'success' },
  GOOD: { label: 'Boa', tone: 'info' },
  BELOW: { label: 'Abaixo do mínimo', tone: 'neutral' },
};

export const OFFER_KIND: Record<OfferKind, string> = {
  FLASH: 'Oferta relâmpago',
  TOP_DISCOUNT_OF_DAY: 'Maior desconto do dia',
  COMMON: 'Oferta comum',
  EXCEPTIONAL_PRICE: 'Preço excepcional',
  POPULAR: 'Popular',
  COUPON: 'Com cupom',
};

export const PUBLICATION_STATUS: Record<PublicationStatus, Labeled> = {
  PENDING: { label: 'Pendente', tone: 'warning' },
  SCHEDULED: { label: 'Agendada', tone: 'info' },
  SENDING: { label: 'Enviando', tone: 'info' },
  SENT: { label: 'Enviada (confirmada)', tone: 'success' },
  FAILED: { label: 'Falhou (nova tentativa)', tone: 'danger' },
  DEAD: { label: 'Falha definitiva', tone: 'danger' },
  MANUAL_READY: { label: 'Pronta p/ publicar manualmente', tone: 'primary' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

export const LINK_STATUS: Record<string, Labeled> = {
  PENDING: { label: 'Pendente', tone: 'warning' },
  VALIDATED: { label: 'Validado', tone: 'success' },
  INVALID: { label: 'Inválido', tone: 'danger' },
};
export const LINK_KIND: Record<string, string> = { MANUAL: 'Manual', IMPORTED: 'Importado', GENERATED: 'Gerado (oficial)' };

export const JOB_STATUS: Record<string, Labeled> = {
  IDLE: { label: 'Ocioso', tone: 'neutral' },
  RUNNING: { label: 'Em execução', tone: 'info' },
  SUCCEEDED: { label: 'Sucesso', tone: 'success' },
  FAILED: { label: 'Falhou', tone: 'danger' },
};

export const LOG_LEVEL: Record<string, Labeled> = {
  DEBUG: { label: 'Debug', tone: 'neutral' },
  INFO: { label: 'Info', tone: 'info' },
  WARN: { label: 'Aviso', tone: 'warning' },
  ERROR: { label: 'Erro', tone: 'danger' },
};

export const CHANNEL_TYPE: Record<ChannelType, { label: string; mode: 'A' | 'B' | 'C' }> = {
  WHATSAPP_CLOUD_GROUP: { label: 'WhatsApp Groups API', mode: 'A' },
  WHATSAPP_MANUAL_QUEUE: { label: 'Fila manual (WhatsApp)', mode: 'B' },
  TELEGRAM: { label: 'Telegram', mode: 'C' },
  WEBHOOK: { label: 'Webhook', mode: 'C' },
};

export const WEIGHT_LABELS: Record<WeightKey, { label: string; hint: string }> = {
  discount: { label: 'Desconto', hint: 'Só pontua com referência verificada.' },
  savings: { label: 'Economia (R$)', hint: 'Valor absoluto economizado, quando verificado.' },
  historical: { label: 'Histórico de preço', hint: 'Preço atual vs. histórico próprio.' },
  seller: { label: 'Vendedor', hint: 'Reputação real informada pela fonte.' },
  availability: { label: 'Disponibilidade', hint: 'Estoque informado pela fonte.' },
  demand: { label: 'Demanda', hint: 'Vendidos informados pela fonte.' },
  category: { label: 'Categoria', hint: 'Relevância configurada da categoria.' },
  recency: { label: 'Novidade', hint: 'Há quanto tempo o produto foi visto.' },
  listingQuality: { label: 'Qualidade do anúncio', hint: 'Fotos, frete, garantia (dados reais).' },
};

/** Rótulo de critério do score (chaves do `scoreBreakdown`); desconhecida cai no próprio nome. */
export const criterionLabel = (key: string): string => WEIGHT_LABELS[key as WeightKey]?.label ?? key;

/** Explicações (pt-BR) para os códigos 409 de publicação bloqueada. */
export const PUBLISH_BLOCK_HELP: Record<string, { title: string; help: string }> = {
  NO_VALIDATED_LINK: {
    title: 'Sem link de afiliado validado',
    help: 'Nenhuma oferta é publicada sem um link de afiliado validado. Cadastre ou importe o link em Afiliados e valide-o.',
  },
  OFFER_NOT_APPROVED: { title: 'Oferta não aprovada', help: 'Aprove a oferta antes de publicar.' },
  DUPLICATE: { title: 'Publicação duplicada', help: 'Esta oferta já foi enfileirada ou publicada neste canal (evita envio em dobro).' },
  OUT_OF_WINDOW: { title: 'Fora da janela permitida', help: 'Horário de silêncio ou intervalo mínimo entre publicações. Ajuste em Automação ou aguarde.' },
  LIMIT_REACHED: { title: 'Limite atingido', help: 'O limite por hora, dia ou categoria foi atingido. Ajuste em Automação ou aguarde.' },
  CHANNEL_DISABLED: { title: 'Canal desativado', help: 'Ative um canal em Integrações para publicar.' },
  STALE_PRICE: { title: 'Preço desatualizado', help: 'O preço mudou desde a descoberta. Aguarde a próxima busca para revalidar a oferta.' },
  SUSPENDED_PRODUCT: { title: 'Produto suspenso', help: 'Dados inconsistentes: o produto está suspenso temporariamente.' },
  CONFLICT: { title: 'Conflito de estado', help: 'O estado da oferta mudou. Atualize a lista e tente novamente.' },
};
