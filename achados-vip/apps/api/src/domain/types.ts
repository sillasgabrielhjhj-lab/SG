/** Contratos compartilhados entre fontes, serviços, adaptadores e workers. Dinheiro = centavos (Int). */

export interface SellerInfo {
  id: string;
  name?: string;
  /** Dados reais da API; ausentes => critério não pontua (nunca inventar). */
  reputationLevel?: 'green' | 'light_green' | 'yellow' | 'orange' | 'red' | null;
  powerSellerStatus?: string | null;
  positiveRatio?: number | null; // 0..1
  completedTransactions?: number | null;
}

/** Item normalizado vindo de qualquer fonte (API do ML, fixture, ...). */
export interface NormalizedListing {
  source: string; // "mercadolivre"
  externalId: string; // MLB...
  catalogProductId?: string | null;
  variationId?: string | null;
  title: string;
  permalink: string;
  thumbnail?: string | null;
  imageUrl?: string | null;
  mlCategoryId?: string | null;
  condition?: string | null; // "new" | "used"
  priceCents: number;
  /** Preço "de" informado pela fonte (ex.: original_price da API). Pode ser só anunciado. */
  advertisedOriginalPriceCents?: number | null;
  availableQuantity?: number | null;
  soldQuantity?: number | null;
  seller?: SellerInfo | null;
  flashDeal?: boolean; // somente se a fonte indicar explicitamente
  coupon?: { code?: string | null; discountCents?: number | null } | null;
  installments?: { quantity: number; amountCents: number; interestFree: boolean } | null;
  /** Qualidade do anúncio (somente dados reais): nº de fotos, tem GTIN/atributos, frete grátis etc. */
  quality?: { pictureCount?: number; hasWarranty?: boolean; freeShipping?: boolean; listingType?: string } | null;
  observedAt: Date;
}

export interface FetchContext {
  mlCategoryIds: string[];
  searchTerms: string[];
  limit: number;
}

/** Fonte de ofertas. Implementações: MercadoLivreApiSource, FixtureSource. */
export interface OfferSource {
  readonly name: string;
  /** Lança SourceAuthError se faltar/expirar credencial; SourceRateLimitError em 429. */
  fetchListings(ctx: FetchContext): Promise<NormalizedListing[]>;
  /** Revalida preço/estoque de um item antes de publicar. Retorna null se indisponível. */
  fetchListing(externalId: string): Promise<NormalizedListing | null>;
  healthCheck(): Promise<HealthResult>;
}

export interface HealthResult {
  ok: boolean;
  status: 'CONNECTED' | 'ERROR' | 'AUTH_REQUIRED';
  detail: string;
}

export class SourceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceAuthError';
  }
}
export class SourceRateLimitError extends Error {
  constructor(message: string, public readonly retryAfterMs?: number) {
    super(message);
    this.name = 'SourceRateLimitError';
  }
}

export interface ScoreInput {
  listing: NormalizedListing;
  /** Preço de referência VERIFICADO (histórico próprio ou fonte confiável). null = sem referência. */
  verifiedReferenceCents: number | null;
  history: { priceCents: number; observedAt: Date }[]; // observações anteriores do mesmo produto
  categoryRelevance: number; // 0..100
  firstSeenAt: Date;
  now: Date;
}

export interface ScoreResult {
  score: number; // 0..100 inteiro
  tier: 'EXCEPTIONAL' | 'EXCELLENT' | 'GOOD' | 'BELOW';
  breakdown: Record<string, { points: number; max: number; note: string }>;
  discountPct: number | null; // somente com referência verificada
  savingsCents: number | null;
  discountVerified: boolean;
  /** true se só há desconto anunciado e não verificado (não deve ser exibido como "de/por"). */
  advertisedOnly: boolean;
}

export type OfferKindName = 'FLASH' | 'TOP_DISCOUNT_OF_DAY' | 'COMMON' | 'EXCEPTIONAL_PRICE' | 'POPULAR' | 'COUPON';

export interface MessageInput {
  title: string;
  priceCents: number;
  originalPriceCents?: number | null; // só se verificado
  discountPct?: number | null;
  installments?: { quantity: number; amountCents: number; interestFree: boolean } | null;
  couponCode?: string | null;
  couponDiscountCents?: number | null;
  affiliateUrl: string; // OBRIGATÓRIO e já validado
  kind: OfferKindName;
  disclosure: string;
  soldQuantity?: number | null;
}

export type MessageFormat = 'whatsapp' | 'telegram_html' | 'plain';

/** Resultado de uma tentativa de envio. */
export interface SendResult {
  ok: boolean;
  /** Só true quando a integração CONFIRMOU o recebimento (ex.: id de mensagem). */
  confirmed: boolean;
  externalMessageId?: string;
  httpStatus?: number;
  error?: string;
  /** true => não adianta retentar (ex.: credencial inválida, payload rejeitado) */
  permanent?: boolean;
  /** true => precisa de autenticação manual */
  authRequired?: boolean;
  retryAfterMs?: number;
  response?: unknown; // sanitizado
}

export interface PublishPayload {
  text: string; // já formatado para o canal
  imageUrl?: string | null;
  idempotencyKey: string;
}

/** Adaptador de canal. Implementações: WhatsAppCloudGroup, ManualQueue, Telegram, Webhook. */
export interface PublisherAdapter {
  readonly type: 'WHATSAPP_CLOUD_GROUP' | 'WHATSAPP_MANUAL_QUEUE' | 'TELEGRAM' | 'WEBHOOK';
  readonly format: MessageFormat;
  /** Canais "manuais" não enviam: marcam a Publication como MANUAL_READY. */
  readonly automatic: boolean;
  send(payload: PublishPayload): Promise<SendResult>;
  healthCheck(): Promise<HealthResult>;
}
