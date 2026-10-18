/**
 * MercadoLivreApiSource — fonte de ofertas pela API OFICIAL do Mercado Livre (OAuth2, refresh_token).
 *
 * HONESTIDADE: o sandbox de desenvolvimento bloqueia api.mercadolibre.com. NENHUMA chamada real foi feita;
 * o código segue a documentação/pesquisa e foi exercitado apenas contra um SIMULADOR local (tests/sim).
 * O que AINDA PRECISA ser validado com credenciais reais (use "Testar fonte" no painel):
 *  1. /sites/MLB/search aceita o token do seu app? (há relatos de HTTP 403 desde 2025; nesse caso vira SourceAuthError
 *     e o painel mostra "Autenticação necessária" com a causa — o adaptador NÃO tenta contornar).
 *  2. Rotação do refresh_token: assumimos uso único (cada renovação devolve um novo). O novo é entregue a
 *     `onRefreshTokenRotated` para ser persistido. Dois processos renovando ao mesmo tempo podem se invalidar.
 *  3. Campos da busca/itens: price, original_price, available_quantity, sold_quantity, thumbnail, permalink,
 *     catalog_product_id, shipping.free_shipping, installments{quantity,amount,rate}, pictures, warranty, status, tags.
 *     Só o que vier na resposta é mapeado; ausente => null/undefined (nunca inventado).
 *  4. installments.rate === 0 => sem juros (se `rate` não vier, o parcelamento é omitido).
 *  5. /users/{id}: reputação de terceiros (level_id "5_green", power_seller_status, transactions.ratings.positive 0..1,
 *     transactions.completed) pode exigir permissões extras; 401/403 aqui apenas desliga a consulta (dado opcional).
 *  6. Oferta relâmpago: só marcamos `flashDeal` se `tags` trouxer "lightning_deal" (nome da tag a confirmar).
 *     `deal_ids` NÃO é tratado como relâmpago nem como cupom.
 *  7. Cupons: a API pública de itens não expõe cupom => `coupon` nunca é preenchido por esta fonte.
 *  8. sale_price (preço promocional estruturado) NÃO é usado; usamos `price`/`original_price`.
 *
 * Erros tipados: 401/403 => SourceAuthError; 429 => SourceRateLimitError (Retry-After respeitado);
 * 5xx/rede/timeout => retentativa com backoff e depois SourceUnavailableError/SourceTimeoutError;
 * JSON/estrutura inválida => SourceInvalidResponseError; demais 4xx => SourceRequestError.
 */
import { SourceAuthError, SourceRateLimitError } from '../../domain/types.js';
import type { FetchContext, HealthResult, NormalizedListing, OfferSource, SellerInfo } from '../../domain/types.js';
import { httpRequest, parseRetryAfter, type HttpResult } from '../../lib/http.js';
import { logger, scrubString } from '../../lib/logger.js';
import { SafeFetchError, SafeFetchTimeoutError, type AllowPrivate } from '../../lib/ssrf.js';
import { sleep } from '../../lib/time.js';

// ---------- erros tipados (além de SourceAuthError/SourceRateLimitError, definidos em domain/types) ----------

export class SourceError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = new.target.name;
  }
}
/** 5xx, queda de rede ou resposta indisponível após as retentativas. */
export class SourceUnavailableError extends SourceError {}
export class SourceTimeoutError extends SourceUnavailableError {}
/** Corpo que não é JSON ou não tem a estrutura mínima esperada. */
export class SourceInvalidResponseError extends SourceError {}
/** Outros 4xx (parâmetro/categoria inválidos etc.). */
export class SourceRequestError extends SourceError {}

// ---------- tipos e opções ----------

export interface MlCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface MercadoLivreOptions {
  /** null => fonte não configurada: toda chamada lança SourceAuthError. */
  credentials: MlCredentials | null;
  /** Padrão https://api.mercadolibre.com. Configurável para o simulador de testes. */
  baseUrl?: string;
  siteId?: string;
  timeoutMs?: number;
  /** Tentativas extras em 5xx/timeout/429 curto. Padrão 2. */
  maxRetries?: number;
  retryBaseDelayMs?: number;
  /** Maior Retry-After (ms) que o adaptador espera sozinho; acima disso lança SourceRateLimitError. */
  maxRetryAfterWaitMs?: number;
  /** Intervalo mínimo entre inícios de requisição (ms). Padrão 250. */
  minDelayMs?: number;
  maxConcurrency?: number;
  /** Itens por página de busca (a API aceita no máx. 50). */
  pageSize?: number;
  /** Complementa a busca com /items?ids= (estoque, fotos, garantia, status). Padrão true. */
  enrichItems?: boolean;
  /** Consulta /users/{id} para a reputação do vendedor. Padrão true. */
  lookupSellers?: boolean;
  maxSellerLookups?: number;
  sellerCacheTtlMs?: number;
  /** SOMENTE testes (simulador em localhost); a lib recusa em produção. */
  allowPrivate?: AllowPrivate;
  /** Chamado quando a renovação devolve um refresh_token novo (persistir!). */
  onRefreshTokenRotated?: (next: MlCredentials) => Promise<void> | void;
  /** Recarrega as credenciais (ex.: outro processo já rotacionou o refresh_token). */
  reloadCredentials?: () => Promise<MlCredentials | null>;
}

const DEFAULT_BASE_URL = 'https://api.mercadolibre.com';
const MULTIGET_MAX = 20;
const MAX_SEARCH_OFFSET = 1000;
const TOKEN_SKEW_MS = 60_000;
const FLASH_TAGS = ['lightning_deal'];

type Json = Record<string, unknown>;
type Query = Record<string, string | number | undefined>;

// ---------- mapeamento (puro, exportado para testes) ----------

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const idStr = (v: unknown): string | null => (typeof v === 'number' && Number.isFinite(v) ? String(v) : str(v));
const toCents = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n * 100);
};

const LEVELS: Record<string, NonNullable<SellerInfo['reputationLevel']>> = {
  green: 'green',
  light_green: 'light_green',
  yellow: 'yellow',
  orange: 'orange',
  red: 'red',
};

/** "5_green" => "green"; formatos desconhecidos => null (sem dado). */
function parseLevel(levelId: unknown): SellerInfo['reputationLevel'] {
  const s = str(levelId);
  if (!s) return null;
  const key = s.replace(/^\d+_/, '').toLowerCase();
  return LEVELS[key] ?? null;
}

/** Reputação a partir de `seller_reputation` (objeto de /users/{id} ou embutido na busca). */
export function parseSellerReputation(rep: unknown): Partial<SellerInfo> {
  if (!isObj(rep)) return {};
  const out: Partial<SellerInfo> = {};
  const level = parseLevel(rep.level_id);
  if (level) out.reputationLevel = level;
  const power = str(rep.power_seller_status);
  if (power) out.powerSellerStatus = power;
  const tx = isObj(rep.transactions) ? rep.transactions : null;
  const completed = num(tx?.completed);
  if (completed !== null && completed >= 0) out.completedTransactions = completed;
  const ratings = isObj(tx?.ratings) ? tx.ratings : null;
  const positive = num(ratings?.positive);
  if (positive !== null && positive >= 0) {
    // a API usa fração 0..1; se vier em % (1 < x <= 100), converte
    const ratio = positive <= 1 ? positive : positive <= 100 ? positive / 100 : null;
    if (ratio !== null) out.positiveRatio = ratio;
  }
  return out;
}

/** Item da API (busca ou /items) => NormalizedListing. null se faltar o mínimo (id, título, permalink, preço) ou o item não estiver ativo. */
export function mapMlItem(raw: unknown, opts: { seller?: SellerInfo | null; observedAt?: Date; source?: string } = {}): NormalizedListing | null {
  if (!isObj(raw)) return null;
  const externalId = idStr(raw.id);
  const title = str(raw.title);
  const permalink = str(raw.permalink);
  const priceCents = toCents(raw.price);
  if (!externalId || !title || !permalink || priceCents === null) return null;
  const status = str(raw.status);
  if (status && status !== 'active') return null;

  const originalCents = toCents(raw.original_price);
  const sellerRaw = isObj(raw.seller) ? raw.seller : null;
  const sellerId = idStr(sellerRaw?.id) ?? idStr(raw.seller_id);
  let seller: SellerInfo | null = opts.seller ?? null;
  if (!seller && sellerId) {
    seller = { id: sellerId, ...(str(sellerRaw?.nickname) ? { name: str(sellerRaw?.nickname)! } : {}), ...parseSellerReputation(sellerRaw?.seller_reputation) };
  }

  const thumbRaw = str(raw.secure_thumbnail) ?? str(raw.thumbnail);
  const thumbnail = thumbRaw ? thumbRaw.replace(/^http:\/\//i, 'https://') : null;
  const pictures = Array.isArray(raw.pictures) ? raw.pictures.filter(isObj) : null;
  const imageUrl = pictures?.length ? (str(pictures[0]!.secure_url) ?? str(pictures[0]!.url)) : null;

  const inst = isObj(raw.installments) ? raw.installments : null;
  const instQty = num(inst?.quantity);
  const instAmount = toCents(inst?.amount);
  const instRate = num(inst?.rate);
  const installments =
    instQty !== null && instQty > 0 && instAmount !== null && instAmount > 0 && instRate !== null
      ? { quantity: Math.trunc(instQty), amountCents: instAmount, interestFree: instRate === 0 }
      : null;

  const quality: NonNullable<NormalizedListing['quality']> = {};
  if (pictures) quality.pictureCount = pictures.length;
  if ('warranty' in raw) {
    const w = str(raw.warranty);
    quality.hasWarranty = w !== null && !/^sem garantia/i.test(w);
  }
  const shipping = isObj(raw.shipping) ? raw.shipping : null;
  if (typeof shipping?.free_shipping === 'boolean') quality.freeShipping = shipping.free_shipping;
  if (str(raw.listing_type_id)) quality.listingType = str(raw.listing_type_id)!;

  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [];
  const available = num(raw.available_quantity);
  const sold = num(raw.sold_quantity);
  const variationId = idStr(raw.variation_id);

  return {
    source: opts.source ?? 'mercadolivre',
    externalId,
    catalogProductId: str(raw.catalog_product_id),
    variationId,
    title,
    permalink,
    thumbnail,
    imageUrl,
    mlCategoryId: str(raw.category_id),
    condition: str(raw.condition),
    priceCents,
    advertisedOriginalPriceCents: originalCents !== null && originalCents > priceCents ? originalCents : null,
    availableQuantity: available,
    soldQuantity: sold,
    seller,
    ...(tags.some((t) => FLASH_TAGS.includes(t)) ? { flashDeal: true } : {}),
    coupon: null,
    installments,
    quality: Object.keys(quality).length ? quality : null,
    observedAt: opts.observedAt ?? new Date(),
  };
}

// ---------- fonte ----------

export class MercadoLivreApiSource implements OfferSource {
  readonly name = 'mercadolivre';
  /** Avisos não fatais da última fetchListings (ex.: categoria inválida ignorada). */
  lastWarnings: string[] = [];

  private creds: MlCredentials | null;
  private readonly baseUrl: string;
  private readonly siteId: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly maxRetryAfterWaitMs: number;
  private readonly minDelayMs: number;
  private readonly maxConcurrency: number;
  private readonly pageSize: number;
  private readonly enrichItems: boolean;
  private readonly lookupSellers: boolean;
  private readonly maxSellerLookups: number;
  private readonly sellerCacheTtlMs: number;

  private token: { value: string; expiresAt: number } | null = null;
  private refreshing: Promise<string> | null = null;
  private active = 0;
  private waiters: (() => void)[] = [];
  private nextStartAt = 0;
  private pauseUntil = 0;
  private sellerBlockedUntil = 0;
  private sellerCache = new Map<string, { at: number; info: Partial<SellerInfo> | null }>();

  constructor(private readonly opts: MercadoLivreOptions) {
    this.creds = opts.credentials ? { ...opts.credentials } : null;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.siteId = opts.siteId ?? 'MLB';
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.retryBaseDelayMs = opts.retryBaseDelayMs ?? 500;
    this.maxRetryAfterWaitMs = opts.maxRetryAfterWaitMs ?? 20_000;
    this.minDelayMs = opts.minDelayMs ?? 250;
    this.maxConcurrency = Math.max(1, opts.maxConcurrency ?? 2);
    this.pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 50));
    this.enrichItems = opts.enrichItems ?? true;
    this.lookupSellers = opts.lookupSellers ?? true;
    this.maxSellerLookups = opts.maxSellerLookups ?? 40;
    this.sellerCacheTtlMs = opts.sellerCacheTtlMs ?? 6 * 3_600_000;
  }

  // ----- OfferSource -----

  async fetchListings(ctx: FetchContext): Promise<NormalizedListing[]> {
    this.lastWarnings = [];
    const limit = Math.max(1, Math.trunc(ctx.limit));
    const queries: { category?: string; q?: string }[] = [
      ...ctx.mlCategoryIds.map((category) => ({ category })),
      ...ctx.searchTerms.map((q) => ({ q })),
    ];
    if (queries.length === 0) return [];
    const perQuery = Math.ceil(limit / queries.length);

    const raws = new Map<string, Json>();
    let lastRequestError: unknown;
    let okQueries = 0;
    for (const query of queries) {
      try {
        await this.searchInto(raws, query, perQuery);
        okQueries++;
      } catch (err) {
        // parâmetro/categoria inválidos afetam só aquela consulta; auth, limite e indisponibilidade abortam tudo
        if (!(err instanceof SourceRequestError)) throw err;
        lastRequestError = err;
        this.lastWarnings.push(`consulta ${JSON.stringify(query)} ignorada: ${err.message}`);
      }
    }
    if (okQueries === 0 && lastRequestError) throw lastRequestError;

    let items = [...raws.values()].slice(0, limit);
    if (this.enrichItems) items = await this.enrich(items);
    const sellers = this.lookupSellers ? await this.lookupSellerInfo(items) : new Map<string, Partial<SellerInfo>>();

    const observedAt = new Date();
    const out: NormalizedListing[] = [];
    for (const raw of items) {
      const sid = idStr(isObj(raw.seller) ? raw.seller.id : undefined) ?? idStr(raw.seller_id);
      const extra = sid ? sellers.get(sid) : undefined;
      const listing = mapMlItem(raw, { observedAt });
      if (!listing) continue;
      if (extra && listing.seller) listing.seller = { ...listing.seller, ...extra };
      out.push(listing);
    }
    return out;
  }

  async fetchListing(externalId: string): Promise<NormalizedListing | null> {
    const [one] = await this.fetchListingsByIds([externalId]);
    return one ?? null;
  }

  /** Revalida até 20 itens por chamada (multiget). Itens inexistentes/inativos ficam de fora. */
  async fetchListingsByIds(ids: string[]): Promise<NormalizedListing[]> {
    const out: NormalizedListing[] = [];
    const observedAt = new Date();
    for (let i = 0; i < ids.length; i += MULTIGET_MAX) {
      const chunk = ids.slice(i, i + MULTIGET_MAX);
      const entries = await this.multiget(chunk);
      const bodies = entries.map((e) => e.body).filter((b): b is Json => b !== null);
      const sellers = this.lookupSellers ? await this.lookupSellerInfo(bodies) : new Map<string, Partial<SellerInfo>>();
      for (const body of bodies) {
        const sid = idStr(body.seller_id) ?? idStr(isObj(body.seller) ? body.seller.id : undefined);
        const listing = mapMlItem(body, { observedAt });
        if (!listing) continue;
        const extra = sid ? sellers.get(sid) : undefined;
        if (extra && listing.seller) listing.seller = { ...listing.seller, ...extra };
        out.push(listing);
      }
    }
    return out;
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.creds) {
      return { ok: false, status: 'AUTH_REQUIRED', detail: 'Credenciais do Mercado Livre não configuradas (ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REFRESH_TOKEN).' };
    }
    try {
      await this.getAccessToken();
      const res = await this.call(`/sites/${this.siteId}/search`, { q: 'teste', limit: 1 });
      this.parseJson(res);
      return { ok: true, status: 'CONNECTED', detail: 'Token válido e busca respondeu (HTTP 200).' };
    } catch (err) {
      if (err instanceof SourceAuthError) return { ok: false, status: 'AUTH_REQUIRED', detail: err.message };
      return { ok: false, status: 'ERROR', detail: err instanceof Error ? scrubString(err.message) : 'erro desconhecido' };
    }
  }

  // ----- busca / itens / vendedores -----

  private async searchInto(into: Map<string, Json>, query: { category?: string; q?: string }, budget: number): Promise<void> {
    let offset = 0;
    let got = 0;
    while (got < budget && offset < MAX_SEARCH_OFFSET) {
      const pageLimit = Math.min(this.pageSize, budget - got);
      const res = await this.call(`/sites/${this.siteId}/search`, { ...query, limit: pageLimit, offset });
      const body = this.parseJson(res);
      if (!isObj(body) || !Array.isArray(body.results)) throw new SourceInvalidResponseError('Resposta de busca sem "results".');
      for (const r of body.results) {
        const id = isObj(r) ? idStr(r.id) : null;
        if (!id || !isObj(r) || into.has(id)) continue;
        into.set(id, r);
        got++;
        if (got >= budget) break;
      }
      offset += body.results.length;
      const total = isObj(body.paging) ? num(body.paging.total) : null;
      if (body.results.length === 0 || (total !== null && offset >= total)) break;
    }
  }

  /**
   * /items?ids= => uma entrada por id pedido. `body` só existe com code 200; 404/410 (`gone`) = anúncio inexistente.
   * Para erros por item o id é inferido pela posição (a API devolve na ordem pedida).
   */
  private async multiget(ids: string[]): Promise<{ id: string; gone: boolean; body: Json | null }[]> {
    const res = await this.call('/items', { ids: ids.join(',') });
    const data = this.parseJson(res);
    if (!Array.isArray(data)) throw new SourceInvalidResponseError('Resposta de /items sem lista.');
    const out: { id: string; gone: boolean; body: Json | null }[] = [];
    data.forEach((entry, index) => {
      if (!isObj(entry)) return;
      const code = num(entry.code);
      const body = isObj(entry.body) ? entry.body : null;
      if (code === 200 && body) {
        out.push({ id: idStr(body.id) ?? ids[index] ?? '', gone: false, body });
      } else if (code !== null && code >= 500) {
        throw new SourceUnavailableError(`Item indisponível no multiget (código ${code}).`, code);
      } else {
        out.push({ id: ids[index] ?? '', gone: code === 404 || code === 410, body: null }); // 403 etc.: mantém só os dados da busca
      }
    });
    return out;
  }

  /** Mescla os dados de /items sobre os da busca (o item vence). Falhas não fatais mantêm só a busca. */
  private async enrich(items: Json[]): Promise<Json[]> {
    const byId = new Map(items.map((r) => [idStr(r.id)!, r]));
    const ids = [...byId.keys()];
    for (let i = 0; i < ids.length; i += MULTIGET_MAX) {
      try {
        for (const e of await this.multiget(ids.slice(i, i + MULTIGET_MAX))) {
          if (e.body && byId.has(e.id)) byId.set(e.id, { ...byId.get(e.id)!, ...e.body });
          else if (e.gone) byId.delete(e.id);
        }
      } catch (err) {
        if (err instanceof SourceAuthError || err instanceof SourceRateLimitError) throw err;
        this.lastWarnings.push(`complemento via /items ignorado: ${err instanceof Error ? err.message : 'erro'}`);
      }
    }
    return [...byId.values()];
  }

  private async lookupSellerInfo(items: Json[]): Promise<Map<string, Partial<SellerInfo>>> {
    const result = new Map<string, Partial<SellerInfo>>();
    const nowMs = Date.now();
    const toFetch: string[] = [];
    for (const raw of items) {
      const sid = idStr(isObj(raw.seller) ? raw.seller.id : undefined) ?? idStr(raw.seller_id);
      if (!sid || result.has(sid)) continue;
      // reputação já embutida na resposta => dispensa consulta
      if (isObj(raw.seller) && isObj(raw.seller.seller_reputation)) continue;
      const cached = this.sellerCache.get(sid);
      if (cached && nowMs - cached.at < this.sellerCacheTtlMs) {
        if (cached.info) result.set(sid, cached.info);
        continue;
      }
      if (!toFetch.includes(sid)) toFetch.push(sid);
    }
    for (const sid of toFetch.slice(0, this.maxSellerLookups)) {
      if (Date.now() < this.sellerBlockedUntil) break;
      try {
        const res = await this.call(`/users/${encodeURIComponent(sid)}`, {}, { allowStatus: [404] });
        const user = res.ok ? this.parseJson(res) : null;
        const info = isObj(user) ? parseSellerReputation(user.seller_reputation) : null;
        const usable = info && Object.keys(info).length ? info : null;
        this.sellerCache.set(sid, { at: Date.now(), info: usable });
        if (usable) result.set(sid, usable);
      } catch (err) {
        if (err instanceof SourceAuthError) {
          // reputação é dado opcional: sem permissão, só deixamos de consultar por um tempo
          this.sellerBlockedUntil = Date.now() + 10 * 60_000;
          this.lastWarnings.push('reputação de vendedores indisponível (sem permissão em /users); critério "vendedor" ficará sem dado.');
          break;
        }
        if (err instanceof SourceRateLimitError) {
          this.lastWarnings.push('limite de requisições ao consultar vendedores; reputação parcial nesta execução.');
          break;
        }
        this.lastWarnings.push(`vendedor ${sid} sem reputação: ${err instanceof Error ? err.message : 'erro'}`);
      }
    }
    return result;
  }

  // ----- HTTP -----

  private parseJson(res: HttpResult): unknown {
    try {
      return res.json();
    } catch {
      throw new SourceInvalidResponseError(`Resposta inválida (não é JSON) de ${res.url}.`, res.status);
    }
  }

  private backoff(attempt: number): number {
    return this.retryBaseDelayMs * 2 ** attempt;
  }

  /** Limita concorrência e espaça o início das requisições; respeita pausa global de Retry-After. */
  private async acquire(): Promise<void> {
    if (this.active >= this.maxConcurrency) await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active++;
    const nowMs = Date.now();
    const startAt = Math.max(nowMs, this.nextStartAt, this.pauseUntil);
    this.nextStartAt = startAt + this.minDelayMs;
    if (startAt > nowMs) await sleep(startAt - nowMs);
  }
  private release(): void {
    this.active--;
    this.waiters.shift()?.();
  }

  private async send(path: string, query: Query, token: string): Promise<HttpResult> {
    await this.acquire();
    try {
      return await httpRequest(`${this.baseUrl}${path}`, {
        method: 'GET',
        query,
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
        timeoutMs: this.timeoutMs,
        maxBytes: 4 * 1024 * 1024,
        retries: 0,
        ...(this.opts.allowPrivate !== undefined ? { allowPrivate: this.opts.allowPrivate } : {}),
      });
    } finally {
      this.release();
    }
  }

  private networkError(err: unknown): SourceUnavailableError {
    if (err instanceof SafeFetchTimeoutError) return new SourceTimeoutError(`Tempo limite excedido (${this.timeoutMs}ms) ao falar com o Mercado Livre.`);
    const detail = err instanceof SafeFetchError ? err.message : err instanceof Error ? err.message : 'erro de rede';
    return new SourceUnavailableError(`Falha de rede ao falar com o Mercado Livre: ${scrubString(detail)}`);
  }

  /** GET autenticado com retentativas. Lança erros tipados; devolve 2xx (ou status em allowStatus). */
  private async call(path: string, query: Query = {}, opts: { allowStatus?: number[] } = {}): Promise<HttpResult> {
    let attempt = 0;
    let refreshedOn401 = false;
    for (;;) {
      const token = await this.getAccessToken();
      let res: HttpResult;
      try {
        res = await this.send(path, query, token);
      } catch (err) {
        if (attempt < this.maxRetries) {
          await sleep(this.backoff(attempt++));
          continue;
        }
        throw this.networkError(err);
      }
      if (res.ok || opts.allowStatus?.includes(res.status)) return res;

      if (res.status === 401) {
        if (!refreshedOn401) {
          refreshedOn401 = true;
          this.token = null; // token revogado/expirado antes da hora: renova e tenta de novo uma vez
          continue;
        }
        throw new SourceAuthError('Mercado Livre recusou o token (HTTP 401). Reautorize o aplicativo e atualize o refresh_token.');
      }
      if (res.status === 403) {
        throw new SourceAuthError(
          'Mercado Livre negou o acesso (HTTP 403). Verifique se o aplicativo tem permissão para esta API (o bloqueio também ocorre com app sem escopo/aprovação).',
        );
      }
      if (res.status === 429) {
        const wait = parseRetryAfter(res.headers['retry-after']);
        if (wait !== undefined) this.pauseUntil = Math.max(this.pauseUntil, Date.now() + wait);
        if (wait !== undefined && wait <= this.maxRetryAfterWaitMs && attempt < this.maxRetries) {
          attempt++;
          await sleep(wait);
          continue;
        }
        throw new SourceRateLimitError('Mercado Livre limitou as requisições (HTTP 429).', wait);
      }
      if (res.status >= 500) {
        if (attempt < this.maxRetries) {
          await sleep(this.backoff(attempt++));
          continue;
        }
        throw new SourceUnavailableError(`Mercado Livre indisponível (HTTP ${res.status}).`, res.status);
      }
      throw new SourceRequestError(`Mercado Livre recusou a requisição (HTTP ${res.status}).`, res.status);
    }
  }

  // ----- OAuth -----

  private async getAccessToken(): Promise<string> {
    if (!this.creds) {
      throw new SourceAuthError('Credenciais do Mercado Livre não configuradas (ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REFRESH_TOKEN, ou uma credencial "mercadolivre" no painel).');
    }
    if (this.token && this.token.expiresAt - TOKEN_SKEW_MS > Date.now()) return this.token.value;
    this.refreshing ??= this.refreshAccessToken().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async postToken(c: MlCredentials): Promise<HttpResult> {
    for (let attempt = 0; ; attempt++) {
      await this.acquire();
      let res: HttpResult;
      try {
        res = await httpRequest(`${this.baseUrl}/oauth/token`, {
          method: 'POST',
          body: new URLSearchParams({ grant_type: 'refresh_token', client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken }).toString(),
          headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
          timeoutMs: this.timeoutMs,
          retries: 0,
          ...(this.opts.allowPrivate !== undefined ? { allowPrivate: this.opts.allowPrivate } : {}),
        });
      } catch (err) {
        // não repete após rede/timeout: o refresh_token é de uso único e o servidor pode já tê-lo consumido
        throw this.networkError(err);
      } finally {
        this.release();
      }
      if (res.status >= 500 && attempt < this.maxRetries) {
        await sleep(this.backoff(attempt));
        continue;
      }
      return res;
    }
  }

  private async refreshAccessToken(): Promise<string> {
    let creds = this.creds!;
    let res = await this.postToken(creds);
    let body = this.tryJson(res);

    // invalid_grant: outro processo pode ter rotacionado o refresh_token — recarrega e tenta uma vez
    if (res.status === 400 && isObj(body) && body.error === 'invalid_grant' && this.opts.reloadCredentials) {
      const fresh = await this.opts.reloadCredentials().catch(() => null);
      if (fresh && fresh.refreshToken !== creds.refreshToken) {
        creds = fresh;
        this.creds = { ...fresh };
        res = await this.postToken(creds);
        body = this.tryJson(res);
      }
    }

    if (!res.ok) {
      const code = isObj(body) ? (str(body.error) ?? str(body.message)) : null;
      const suffix = code ? ` (${scrubString(code).slice(0, 80)})` : '';
      if (res.status === 429) throw new SourceRateLimitError('Mercado Livre limitou a renovação do token (HTTP 429).', parseRetryAfter(res.headers['retry-after']));
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new SourceAuthError(`Não foi possível renovar o token do Mercado Livre (HTTP ${res.status})${suffix}. Reautorize o aplicativo e atualize as credenciais.`);
      }
      if (res.status >= 500) throw new SourceUnavailableError(`Mercado Livre indisponível ao renovar o token (HTTP ${res.status}).`, res.status);
      throw new SourceRequestError(`Falha ao renovar o token (HTTP ${res.status})${suffix}.`, res.status);
    }
    if (!isObj(body) || !str(body.access_token)) throw new SourceInvalidResponseError('Resposta de /oauth/token sem access_token.');

    const expiresIn = num(body.expires_in) ?? 300;
    this.token = { value: str(body.access_token)!, expiresAt: Date.now() + expiresIn * 1000 };
    const nextRefresh = str(body.refresh_token);
    if (nextRefresh && nextRefresh !== creds.refreshToken) {
      this.creds = { ...creds, refreshToken: nextRefresh };
      try {
        await this.opts.onRefreshTokenRotated?.({ ...this.creds });
      } catch (err) {
        logger.error({ err }, 'falha ao persistir o refresh_token rotacionado do Mercado Livre');
      }
    }
    return this.token.value;
  }

  private tryJson(res: HttpResult): unknown {
    try {
      return res.json();
    } catch {
      return null;
    }
  }
}
