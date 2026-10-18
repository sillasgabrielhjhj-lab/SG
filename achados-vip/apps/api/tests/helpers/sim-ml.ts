/**
 * SIMULADOR local da API do Mercado Livre (SOMENTE testes; nenhuma chamada real é feita).
 *
 * Implementa, de forma simplificada e conforme a documentação pesquisada (a validar com credenciais reais):
 *   POST /oauth/token (refresh_token, uso único e rotação)   GET /sites/MLB/search   GET /items?ids=   GET /users/:id
 * Cada rota aceita "passos roteirizados" (`script`) para injetar 401/403/429/5xx, corpo inválido ou atraso.
 */
import type http from 'node:http';
import { sendJson, startSimServer, wait, type SimRequest, type SimServer } from './sim-server.js';

type Json = Record<string, unknown>;

export interface ScriptStep {
  status?: number;
  body?: unknown;
  /** corpo cru (ex.: HTML), enviado como está */
  raw?: string;
  headers?: Record<string, string>;
  /** responde só depois deste atraso */
  delayMs?: number;
  /** nunca responde (para testar timeout) */
  hang?: boolean;
}
export type ScriptKey = 'token' | 'search' | 'items' | 'users';

export interface MlSimItem {
  id: string;
  /** categoria à qual o item pertence na busca */
  category: string;
  /** visão devolvida pela BUSCA */
  search: Json;
  /** visão devolvida por /items (mesclada sobre a da busca). `null` => /items responde 404 para este id. */
  detail?: Json | null;
  /** código do multiget para este item (padrão 200) */
  multigetCode?: number;
}

export const ML_TEST_CREDS = { clientId: 'cid-12345', clientSecret: 'secret-abcdefgh', refreshToken: 'RT-0' } as const;

/** Visão de um item como a busca do ML o devolve (apenas campos reais; sobrescreva/remova com `over`). */
export function mlSearchItem(id: string, over: Json = {}): Json {
  const digits = id.replace(/\D/g, '');
  const base: Json = {
    id,
    title: `Produto simulado ${id}`,
    price: 199.9,
    original_price: null,
    permalink: `https://produto.mercadolivre.com.br/MLB-${digits}-produto-simulado-_JM`,
    thumbnail: 'http://http2.mlstatic.com/D_NQ_NP_1-I.jpg',
    category_id: 'MLB1055',
    condition: 'new',
    available_quantity: 30,
    sold_quantity: 800,
    seller: { id: 999, nickname: 'LOJA_TESTE' },
    shipping: { free_shipping: true },
    installments: { quantity: 10, amount: 19.99, rate: 0 },
    listing_type_id: 'gold_special',
    tags: [],
  };
  const out: Json = { ...base, ...over };
  for (const [k, v] of Object.entries(over)) if (v === undefined) delete out[k];
  return out;
}

export function mlUser(id: number | string, over: Json = {}): Json {
  return {
    id: Number(id),
    nickname: `LOJA_${id}`,
    seller_reputation: {
      level_id: '5_green',
      power_seller_status: 'platinum',
      transactions: { completed: 8000, ratings: { positive: 0.99, negative: 0.005, neutral: 0.005 } },
    },
    ...over,
  };
}

export class MlSimulator {
  readonly items = new Map<string, MlSimItem>();
  /** vendedor => objeto /users, ou código HTTP de erro (ex.: 403) */
  readonly sellers = new Map<string, Json | number>();
  /** categorias que a "API" recusa com 400 */
  readonly badCategories = new Set<string>();
  readonly issued = new Set<string>();
  readonly revoked = new Set<string>();
  readonly scripts: Record<ScriptKey, ScriptStep[]> = { token: [], search: [], items: [], users: [] };
  /** refresh_token atualmente válido (uso único quando rotateRefresh = true) */
  refreshToken: string = ML_TEST_CREDS.refreshToken;
  rotateRefresh = true;
  accessTtlSec = 21_600;
  tokenSeq = 0;

  private constructor(private readonly server: SimServer) {}

  static async start(): Promise<MlSimulator> {
    let sim!: MlSimulator;
    const server = await startSimServer((req, res) => sim.handle(req, res));
    sim = new MlSimulator(server);
    return sim;
  }

  get baseUrl(): string {
    return this.server.url;
  }
  get requests(): SimRequest[] {
    return this.server.requests;
  }
  close(): Promise<void> {
    return this.server.close();
  }

  /** Requisições recebidas por rota. */
  calls(kind: ScriptKey | 'all' = 'all'): SimRequest[] {
    const match: Record<ScriptKey, (p: string) => boolean> = {
      token: (p) => p === '/oauth/token',
      search: (p) => p.startsWith('/sites/') && p.endsWith('/search'),
      items: (p) => p === '/items',
      users: (p) => p.startsWith('/users/'),
    };
    return kind === 'all' ? this.requests : this.requests.filter((r) => match[kind](r.path));
  }

  /** Zera requisições registradas e scripts (mantém itens, vendedores e credenciais). */
  clearTraffic(): void {
    this.requests.length = 0;
    for (const k of Object.keys(this.scripts) as ScriptKey[]) this.scripts[k] = [];
  }

  addItem(category: string, id: string, searchOver: Json = {}, extra: Partial<Omit<MlSimItem, 'id' | 'category' | 'search'>> = {}): MlSimItem {
    const item: MlSimItem = { id, category, search: mlSearchItem(id, { category_id: category, ...searchOver }), ...extra };
    this.items.set(id, item);
    return item;
  }

  setPrice(id: string, price: number): void {
    const item = this.items.get(id);
    if (!item) throw new Error(`item simulado inexistente: ${id}`);
    item.search = { ...item.search, price };
    if (item.detail) item.detail = { ...item.detail, price };
  }

  revokeAllTokens(): void {
    for (const t of this.issued) this.revoked.add(t);
  }

  script(key: ScriptKey, ...steps: ScriptStep[]): void {
    this.scripts[key].push(...steps);
  }

  // ---------- servidor ----------

  private async scripted(key: ScriptKey, res: http.ServerResponse): Promise<boolean> {
    const step = this.scripts[key].shift();
    if (!step) return false;
    if (step.delayMs) await wait(step.delayMs);
    if (step.hang) return true; // não responde: o cliente deve estourar o prazo
    if (step.raw !== undefined) {
      res.writeHead(step.status ?? 200, { 'content-type': 'text/html', ...(step.headers ?? {}) });
      res.end(step.raw);
    } else {
      sendJson(res, step.status ?? 200, step.body ?? {}, step.headers);
    }
    return true;
  }

  private authorized(req: SimRequest): boolean {
    const m = /^Bearer (\S+)$/.exec(String(req.headers.authorization ?? ''));
    return !!m && this.issued.has(m[1]!) && !this.revoked.has(m[1]!);
  }

  private async handle(req: SimRequest, res: http.ServerResponse): Promise<void> {
    if (req.method === 'POST' && req.path === '/oauth/token') return this.token(req, res);

    const key: ScriptKey | null = req.path === '/items' ? 'items' : req.path.startsWith('/users/') ? 'users' : req.path.startsWith('/sites/') ? 'search' : null;
    if (!key) return sendJson(res, 404, { message: 'Resource not found', error: 'not_found', status: 404 });
    if (await this.scripted(key, res)) return;
    if (!this.authorized(req)) return sendJson(res, 401, { message: 'invalid_token', error: 'not_found', status: 401 });

    if (key === 'search') return this.search(req, res);
    if (key === 'items') return this.multiget(req, res);
    return this.user(req, res);
  }

  private async token(req: SimRequest, res: http.ServerResponse): Promise<void> {
    if (await this.scripted('token', res)) return;
    const f = req.form();
    const ok =
      f.get('grant_type') === 'refresh_token' &&
      f.get('client_id') === ML_TEST_CREDS.clientId &&
      f.get('client_secret') === ML_TEST_CREDS.clientSecret &&
      f.get('refresh_token') === this.refreshToken;
    if (!ok) {
      return sendJson(res, 400, { message: 'Error validating grant. Your authorization code or refresh token may be expired or it was already used', error: 'invalid_grant', status: 400 });
    }
    this.tokenSeq++;
    const access = `AT-${this.tokenSeq}`;
    this.issued.add(access);
    const body: Json = { access_token: access, token_type: 'Bearer', expires_in: this.accessTtlSec, scope: 'offline_access read write', user_id: 1 };
    if (this.rotateRefresh) {
      this.refreshToken = `RT-${this.tokenSeq}`;
      body.refresh_token = this.refreshToken;
    } else {
      body.refresh_token = this.refreshToken;
    }
    sendJson(res, 200, body);
  }

  private search(req: SimRequest, res: http.ServerResponse): void {
    const category = req.query.get('category');
    const q = req.query.get('q');
    if (category && this.badCategories.has(category)) return sendJson(res, 400, { message: 'invalid category', error: 'bad_request', status: 400 });
    const all = [...this.items.values()].filter((i) => (category ? i.category === category : q ? String(i.search.title ?? '').toLowerCase().includes(q.toLowerCase()) : false));
    const offset = Math.max(0, Number(req.query.get('offset') ?? 0));
    const limit = Math.min(50, Math.max(1, Number(req.query.get('limit') ?? 50)));
    sendJson(res, 200, {
      site_id: 'MLB',
      paging: { total: all.length, primary_results: all.length, offset, limit },
      results: all.slice(offset, offset + limit).map((i) => i.search),
    });
  }

  private multiget(req: SimRequest, res: http.ServerResponse): void {
    const ids = (req.query.get('ids') ?? '').split(',').filter(Boolean);
    sendJson(
      res,
      200,
      ids.map((id) => {
        const item = this.items.get(id);
        if (!item || item.detail === null) return { code: 404, body: { message: 'Item not found', error: 'not_found', status: 404 } };
        const code = item.multigetCode ?? 200;
        if (code !== 200) return { code, body: { message: 'error', status: code } };
        return { code: 200, body: { ...item.search, ...(item.detail ?? {}) } };
      }),
    );
  }

  private user(req: SimRequest, res: http.ServerResponse): void {
    const id = req.path.split('/').pop() ?? '';
    const seller = this.sellers.get(id);
    if (typeof seller === 'number') return sendJson(res, seller, { message: 'forbidden', error: 'forbidden', status: seller });
    if (!seller) return sendJson(res, 404, { message: 'User not found', error: 'not_found', status: 404 });
    sendJson(res, 200, seller);
  }
}
