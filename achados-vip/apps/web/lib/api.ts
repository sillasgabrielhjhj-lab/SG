import type {
  AffiliateLinkDTO,
  AffiliateStatus,
  AuditLogDTO,
  CategoryDTO,
  ChannelDTO,
  CredentialSummary,
  DashboardData,
  DeepPartial,
  ImportResult,
  IntegrationsData,
  NotificationDTO,
  OfferDetail,
  OfferDTO,
  Paged,
  PendingProduct,
  PublicationDetail,
  PublicationDTO,
  ReportSummary,
  SessionInfo,
  Settings,
  SystemLogDTO,
  TestResult,
  QuickPreview,
} from './types';

/** Cliente da API (same-origin via rewrite do Next). Tratamento único de erro `{error:{code,message}}`. */

const BASE = '/api';
const CSRF_KEY = 'achados.csrf';

let csrfToken: string | null = null;

function readStored(): string | null {
  try {
    return sessionStorage.getItem(CSRF_KEY);
  } catch {
    return null;
  }
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
  try {
    if (token) sessionStorage.setItem(CSRF_KEY, token);
    else sessionStorage.removeItem(CSRF_KEY);
  } catch {
    /* sessionStorage indisponível: mantém só em memória */
  }
}

export function getCsrfToken(): string | null {
  if (csrfToken === null && typeof window !== 'undefined') csrfToken = readStored();
  return csrfToken;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function errorMessage(err: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.name !== 'AbortError') return err.message || fallback;
  return fallback;
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
/** Chamado quando uma requisição autenticada recebe 401 (sessão expirada/inválida). */
export function onUnauthorized(cb: Listener): () => void {
  unauthorizedListeners.add(cb);
  return () => unauthorizedListeners.delete(cb);
}

export type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Não tratar 401 como sessão expirada (login, troca de senha). */
  noAuthRedirect?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, String(v));
    }
  }
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ''}`;
}

function fallbackError(status: number): ApiError {
  if (status === 429) return new ApiError(status, 'RATE_LIMITED', 'Muitas requisições. Aguarde um instante e tente novamente.');
  if (status === 404) return new ApiError(status, 'NOT_FOUND', 'Recurso não encontrado.');
  if (status === 403) return new ApiError(status, 'FORBIDDEN', 'Acesso negado.');
  if (status >= 500) return new ApiError(status, 'API_UNAVAILABLE', `API indisponível ou com erro (HTTP ${status}). Verifique se o servidor está em execução.`);
  return new ApiError(status, 'HTTP_ERROR', `Falha na requisição (HTTP ${status}).`);
}

async function parseError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const j = JSON.parse(text) as { error?: { code?: string; message?: string; details?: unknown } };
      if (j && typeof j === 'object' && j.error && typeof j.error === 'object') {
        return new ApiError(res.status, String(j.error.code ?? 'ERROR'), String(j.error.message ?? fallbackError(res.status).message), j.error.details);
      }
    } catch {
      /* corpo não é JSON (ex.: proxy sem upstream) */
    }
  }
  return fallbackError(res.status);
}

async function refreshCsrf(): Promise<boolean> {
  try {
    const res = await fetch(buildUrl('/auth/me'), { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return false;
    const j = (await res.json()) as SessionInfo;
    if (j?.csrfToken) {
      setCsrfToken(j.csrfToken);
      return true;
    }
  } catch {
    /* ignora */
  }
  return false;
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const mutating = method !== 'GET' && method !== 'HEAD';
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (mutating) {
    const t = getCsrfToken();
    if (t) headers['X-CSRF-Token'] = t;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body,
      credentials: 'include',
      cache: 'no-store',
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(res.status, 'BAD_RESPONSE', 'Resposta inesperada do servidor.');
    }
  }

  const err = await parseError(res);
  // Token CSRF desatualizado (ex.: sessão renovada): renova uma vez e repete a mutação.
  if (mutating && res.status === 403 && /csrf/i.test(err.code) && !retried && (await refreshCsrf())) {
    return request<T>(method, path, opts, true);
  }
  if (res.status === 401 && !opts.noAuthRedirect) {
    setCsrfToken(null);
    unauthorizedListeners.forEach((cb) => cb());
  }
  throw err;
}

const get = <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal });
const post = <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body });
const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, { body });
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body });
const del = <T>(path: string) => request<T>('DELETE', path);

/** Aceita resposta como array puro ou `{items}` (o contrato descreve "lista" em alguns endpoints). */
function asList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object' && Array.isArray((v as { items?: unknown }).items)) return (v as { items: T[] }).items;
  return [];
}

export interface OfferQuery {
  status?: string;
  categoryId?: string;
  minScore?: number | string;
  q?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface QuickInput {
  url: string;
  title?: string;
  price?: string;
  originalPrice?: string;
  couponCode?: string;
}

export const api = {
  // ---- Gerar post (link de afiliado -> texto + imagem)
  quickPreview: (input: QuickInput) => post<QuickPreview>('/quick/preview', input),

  // ---- Autenticação
  async login(email: string, password: string): Promise<SessionInfo> {
    const s = await post<SessionInfo>('/auth/login', { email, password }, { noAuthRedirect: true });
    setCsrfToken(s.csrfToken);
    return s;
  },
  async logout(): Promise<void> {
    try {
      await post<{ ok: true }>('/auth/logout', undefined, { noAuthRedirect: true });
    } finally {
      setCsrfToken(null);
    }
  },
  async me(signal?: AbortSignal): Promise<SessionInfo> {
    const s = await request<SessionInfo>('GET', '/auth/me', { signal, noAuthRedirect: true });
    setCsrfToken(s.csrfToken);
    return s;
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ ok: true }>('/auth/change-password', { currentPassword, newPassword }, { noAuthRedirect: true }),

  // ---- Dashboard / relatórios / notificações
  dashboard: (signal?: AbortSignal) => get<DashboardData>('/dashboard', undefined, signal),
  reportSummary: (days = 30, signal?: AbortSignal) => get<ReportSummary>('/reports/summary', { days }, signal),
  async notifications(signal?: AbortSignal): Promise<NotificationDTO[]> {
    return asList<NotificationDTO>(await get<unknown>('/notifications', undefined, signal));
  },
  markNotificationRead: (id: string) => post<{ ok: true }>(`/notifications/${encodeURIComponent(id)}/read`),
  markAllNotificationsRead: () => post<{ ok: true; count?: number }>('/notifications/read-all'),

  // ---- Ofertas
  offers: (q: OfferQuery, signal?: AbortSignal) => get<Paged<OfferDTO>>('/offers', q as Query, signal),
  offer: (id: string, signal?: AbortSignal) => get<OfferDetail>(`/offers/${encodeURIComponent(id)}`, undefined, signal),
  approveOffer: (id: string, note?: string) => post<OfferDTO>(`/offers/${encodeURIComponent(id)}/approve`, { note: note || undefined }),
  rejectOffer: (id: string, note?: string) => post<OfferDTO>(`/offers/${encodeURIComponent(id)}/reject`, { note: note || undefined }),
  publishOffer: (id: string, channelId?: string) =>
    post<{ offer: OfferDTO; publications: PublicationDTO[] }>(`/offers/${encodeURIComponent(id)}/publish`, { channelId: channelId || undefined }),

  // ---- Afiliados
  affiliateStatus: (signal?: AbortSignal) => get<AffiliateStatus>('/affiliate/status', undefined, signal),
  affiliateLinks: (q: { status?: string; productId?: string; page?: number }, signal?: AbortSignal) =>
    get<Paged<AffiliateLinkDTO>>('/affiliate/links', q, signal),
  addAffiliateLink: (productId: string, url: string) => post<AffiliateLinkDTO>('/affiliate/links', { productId, url }),
  importAffiliateLinks: (text: string) => post<ImportResult>('/affiliate/links/import', { text }),
  validateAffiliateLink: (id: string) => post<AffiliateLinkDTO>(`/affiliate/links/${encodeURIComponent(id)}/validate`),
  deleteAffiliateLink: (id: string) => del<{ ok: true }>(`/affiliate/links/${encodeURIComponent(id)}`),
  async affiliatePending(signal?: AbortSignal): Promise<PendingProduct[]> {
    return asList<PendingProduct>(await get<unknown>('/affiliate/pending', undefined, signal));
  },
  affiliatePendingCsvUrl: `${BASE}/affiliate/pending.csv`,

  // ---- Publicações
  publications: (q: { status?: string; channelId?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    get<Paged<PublicationDTO>>('/publications', q, signal),
  async manualQueue(signal?: AbortSignal): Promise<PublicationDTO[]> {
    return asList<PublicationDTO>(await get<unknown>('/publications/manual-queue', undefined, signal));
  },
  publication: (id: string, signal?: AbortSignal) => get<PublicationDetail>(`/publications/${encodeURIComponent(id)}`, undefined, signal),
  retryPublication: (id: string) => post<PublicationDTO>(`/publications/${encodeURIComponent(id)}/retry`),
  cancelPublication: (id: string) => post<PublicationDTO>(`/publications/${encodeURIComponent(id)}/cancel`),
  markPublicationSent: (id: string) => post<PublicationDTO>(`/publications/${encodeURIComponent(id)}/mark-sent`),

  // ---- Configurações / categorias / automação
  settings: (signal?: AbortSignal) => get<Settings>('/settings', undefined, signal),
  updateSettings: (patchBody: DeepPartial<Settings>) => put<Settings>('/settings', patchBody),
  categories: (signal?: AbortSignal) => get<unknown>('/categories', undefined, signal).then((v) => asList<CategoryDTO>(v)),
  updateCategory: (id: string, body: Partial<Pick<CategoryDTO, 'enabled' | 'relevance' | 'dailyLimit' | 'minScore' | 'mlCategoryIds' | 'searchTerms'>>) =>
    patch<CategoryDTO>(`/categories/${encodeURIComponent(id)}`, body),
  runDiscovery: () => post<{ queued: boolean; jobId: string }>('/automation/run-discovery'),
  runPublisher: () => post<{ queued: boolean; jobId: string }>('/automation/run-publisher'),

  // ---- Integrações
  integrations: (signal?: AbortSignal) => get<IntegrationsData>('/integrations', undefined, signal),
  saveCredential: (body: { provider: string; name: string; values: Record<string, string> }) =>
    post<CredentialSummary>('/integrations/credentials', body),
  createChannel: (body: { type: string; name: string; config: Record<string, unknown>; credentialId?: string | null; enabled?: boolean }) =>
    post<ChannelDTO>('/integrations/channels', body),
  updateChannel: (id: string, body: Partial<{ name: string; config: Record<string, unknown>; credentialId: string | null; enabled: boolean }>) =>
    patch<ChannelDTO>(`/integrations/channels/${encodeURIComponent(id)}`, body),
  deleteChannel: (id: string) => del<{ ok: true }>(`/integrations/channels/${encodeURIComponent(id)}`),
  testChannel: (id: string) => post<TestResult>(`/integrations/channels/${encodeURIComponent(id)}/test`),
  testSource: () => post<TestResult>('/integrations/source/test'),

  // ---- Logs / auditoria
  logs: (q: { level?: string; scope?: string; page?: number }, signal?: AbortSignal) => get<Paged<SystemLogDTO>>('/logs', q, signal),
  audit: (q: { page?: number }, signal?: AbortSignal) => get<Paged<AuditLogDTO>>('/audit', q, signal),
};
