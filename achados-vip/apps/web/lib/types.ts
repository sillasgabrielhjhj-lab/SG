/** Tipos do painel — espelham docs/CONTRACT.md. Dinheiro sempre em centavos (Int). Datas em ISO-8601. */

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'VIEWER' | (string & {});
}
export interface SessionInfo {
  user: ApiUser;
  csrfToken: string;
}

export type OfferStatus = 'DISCOVERED' | 'APPROVED' | 'REJECTED' | 'QUEUED' | 'PUBLISHED' | 'EXPIRED' | 'SUSPENDED';
export type OfferTier = 'EXCEPTIONAL' | 'EXCELLENT' | 'GOOD' | 'BELOW';
export type OfferKind = 'FLASH' | 'TOP_DISCOUNT_OF_DAY' | 'COMMON' | 'EXCEPTIONAL_PRICE' | 'POPULAR' | 'COUPON';
export type AffiliateLinkStatus = 'PENDING' | 'VALIDATED' | 'INVALID';
export type AffiliateLinkKind = 'MANUAL' | 'IMPORTED' | 'GENERATED';
export type ChannelType = 'WHATSAPP_CLOUD_GROUP' | 'WHATSAPP_MANUAL_QUEUE' | 'TELEGRAM' | 'WEBHOOK';
export type ChannelStatus = 'UNKNOWN' | 'CONNECTED' | 'ERROR' | 'AUTH_REQUIRED' | 'DISABLED' | 'NOT_CONFIGURED';
export type PublicationStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'DEAD'
  | 'MANUAL_READY'
  | 'CANCELLED';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type JobStatus = 'IDLE' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type ScoreBreakdown = Record<string, { points: number; max: number; note: string }>;

export interface OfferDTO {
  id: string;
  status: OfferStatus;
  tier: OfferTier;
  kind: OfferKind;
  score: number;
  scoreBreakdown: ScoreBreakdown | null;
  priceCents: number;
  originalPriceCents: number | null;
  discountPct: number | null;
  savingsCents: number | null;
  discountVerified: boolean;
  couponCode: string | null;
  discoveredAt: string;
  hasValidatedLink: boolean;
  product: {
    id: string;
    title: string;
    thumbnail: string | null;
    permalink: string;
    sellerName: string | null;
    category: { id: string; name: string } | null;
  };
}

export interface PricePoint {
  priceCents: number;
  originalPriceCents: number | null;
  observedAt: string;
  source: string;
}

export interface AffiliateLinkDTO {
  id: string;
  productId: string;
  productTitle: string;
  url: string;
  kind: AffiliateLinkKind;
  status: AffiliateLinkStatus;
  validatedAt: string | null;
  validationNote: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface PublicationDTO {
  id: string;
  offerId: string;
  channelId: string;
  channelName: string;
  channelType: ChannelType;
  status: PublicationStatus;
  template: OfferKind;
  messageText: string;
  imageUrl: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  attemptsCount: number;
  lastError: string | null;
  createdAt: string;
  productTitle: string;
}

export interface PublicationAttempt {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  success: boolean;
  httpStatus: number | null;
  error: string | null;
  response?: unknown;
}
export type PublicationDetail = PublicationDTO & { attempts: PublicationAttempt[] };

export interface OfferDetail extends OfferDTO {
  priceHistory: PricePoint[];
  affiliateLinks: AffiliateLinkDTO[];
  publications: PublicationDTO[];
  messagePreview: { whatsapp: string; telegram: string } | null;
}

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

export interface CategoryDTO {
  id: string;
  key?: string;
  name: string;
  enabled: boolean;
  relevance: number;
  dailyLimit: number | null;
  minScore: number | null;
  mlCategoryIds: string[];
  searchTerms: string[];
}

export interface JobInfo {
  name: string;
  status: JobStatus | (string & {});
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  nextRunAt: string | null;
}

export interface IntegrationSummary {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  status: ChannelStatus | (string & {});
  statusDetail: string | null;
  lastCheckedAt: string | null;
}

export interface DashboardData {
  monitoring: {
    enabled: boolean;
    status: string;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    intervalMinutes: number;
  };
  autoPublish: boolean;
  integrations: IntegrationSummary[];
  source: { name: string; status: ChannelStatus | (string & {}); detail: string | null };
  today: { discovered: number; approved: number; published: number; pending: number; failed: number };
  pendingAffiliateLinks: number;
  unreadNotifications: number;
  series: { date: string; discovered: number; approved: number; published: number }[];
  jobs: JobInfo[];
}

export interface NotificationDTO {
  id: string;
  level: LogLevel;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

export interface AffiliateStatus {
  generation: { available: boolean; reason?: string };
  credentialsConfigured: boolean;
  counts: { pending: number; validated: number; invalid: number };
}

export interface PendingProduct {
  productId: string;
  title: string;
  permalink: string;
  offerId?: string | null;
  score?: number | null;
}

export interface ImportResult {
  imported: number;
  validated: number;
  invalid: { line: number; reason: string }[];
  unmatched: { line: number; reason: string }[];
}

export interface IntegrationMode {
  key: 'A' | 'B' | 'C';
  label: string;
  status: string;
  explanation: string;
}
export interface CredentialSummary {
  id: string;
  provider: string;
  name: string;
  hint: string | null;
  status?: string;
}
export interface SourceInfo {
  name: string;
  status: ChannelStatus | (string & {});
  detail?: string | null;
  statusDetail?: string | null;
  lastCheckedAt?: string | null;
}
export interface IntegrationsData {
  source: SourceInfo;
  channels: ChannelDTO[];
  credentials: CredentialSummary[];
  modes: IntegrationMode[];
}
export interface TestResult {
  ok: boolean;
  status: ChannelStatus | (string & {});
  detail: string;
}

export interface SystemLogDTO {
  id: string;
  level: LogLevel;
  scope: string;
  message: string;
  meta: unknown;
  createdAt: string;
}
export interface AuditLogDTO {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

export interface ReportSummary {
  period: unknown;
  found: number;
  approved: number;
  published: number;
  failed: number;
  byCategory: { categoryId: string; name: string; found: number; qualified: number; published: number }[];
  recentPriceDrops: { productId: string; title: string; fromCents: number; toCents: number; pct: number; at: string }[];
  affiliateMetrics: { available: boolean; reason?: string };
}

/** Espelho de apps/api/src/domain/settings.ts (somente leitura/edição de campos conhecidos). */
export interface Settings {
  monitoring: {
    enabled: boolean;
    intervalMinutes: number;
    maxItemsPerCategory: number;
    source: 'mercadolivre_api' | 'fixture';
    minPriceDropPct: number;
  };
  scoring: {
    weights: Record<WeightKey, number>;
    thresholds: { exceptional: number; excellent: number; good: number };
    minScoreToPublish: number;
    minHistoryObservations: number;
  };
  publishing: {
    autoPublish: boolean;
    minIntervalMinutes: number;
    maxPerHour: number;
    maxPerDay: number;
    maxPerCategoryPerDay: number;
    republishAfterDays: number;
    republishMinAdditionalDropPct: number;
    maxAttempts: number;
    quietHours: { enabled: boolean; start: string; end: string; timezone: string };
  };
  affiliate: { requireValidatedLink: true; allowedHosts: string[]; resolveRedirects: boolean };
  messages: { disclosure: string; showInstallments: boolean; groupName: string };
  alerts: { stuckJobMinutes: number; stuckPublicationMinutes: number };
  retention: { logDays: number; priceHistoryDays: number };
}

export const WEIGHT_KEYS = [
  'discount',
  'savings',
  'historical',
  'seller',
  'availability',
  'demand',
  'category',
  'recency',
  'listingQuality',
] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];

/** Patch parcial recursivo (PUT /api/settings é strict: só enviar campos conhecidos). */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

/** Resposta de POST /api/quick/preview ("Gerar post"). */
export interface QuickPreview {
  ok: boolean;
  needsInput: ('title' | 'price')[];
  found: { title: boolean; price: boolean; image: boolean };
  title: string | null;
  priceCents: number | null;
  originalPriceCents?: number | null;
  imageUrl: string | null;
  whatsapp: string | null;
  telegram: string | null;
  discountPct: number | null;
  warnings: string[];
}
