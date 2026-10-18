import dns from 'node:dns';
import net from 'node:net';
import type { Readable } from 'node:stream';
import { Agent, request } from 'undici';
import { env } from './env.js';

/**
 * Proteção contra SSRF para QUALQUER requisição a URL controlada por usuário/terceiros
 * (validação de links de afiliado, webhooks, imagens...).
 *
 * - `assertSafeUrl`: valida esquema, credenciais, lista de hosts e resolve o DNS; bloqueia
 *   loopback/privado/link-local/metadata/multicast/reservado (IPv4 e IPv6, incluindo
 *   IPv4-mapeado, NAT64 e 6to4).
 * - `safeFetch`: resolve UMA vez por salto e FIXA o IP validado na conexão (anti DNS-rebinding),
 *   segue no máx. 5 redirecionamentos revalidando cada salto, com timeout e limite de tamanho.
 * - `allowPrivate` existe somente para TESTES (simuladores locais) e é recusado em produção.
 */

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;
/** true libera tudo; função libera apenas para hostnames específicos (usado em testes). */
export type AllowPrivate = boolean | ((hostname: string) => boolean);

export class SafeFetchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class SsrfBlockedError extends SafeFetchError {
  constructor(message: string) {
    super('SSRF_BLOCKED', message);
  }
}
export class SafeFetchTimeoutError extends SafeFetchError {
  constructor(ms: number) {
    super('FETCH_TIMEOUT', `tempo limite excedido (${ms}ms)`);
  }
}
export class ResponseTooLargeError extends SafeFetchError {
  constructor(max: number) {
    super('RESPONSE_TOO_LARGE', `resposta maior que o limite de ${max} bytes`);
  }
}
export class TooManyRedirectsError extends SafeFetchError {
  constructor(max: number) {
    super('TOO_MANY_REDIRECTS', `mais de ${max} redirecionamentos`);
  }
}

// ---- Classificação de IPs ---------------------------------------------------------

function parseIPv4(s: string): number[] | null {
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out.push(n);
  }
  return out;
}

function parseIPv6(input: string): number[] | null {
  let s = input.split('%')[0] ?? '';
  if (s.includes('.')) {
    const idx = s.lastIndexOf(':');
    const v4 = parseIPv4(s.slice(idx + 1));
    if (!v4) return null;
    s = `${s.slice(0, idx + 1)}${(((v4[0] ?? 0) << 8) | (v4[1] ?? 0)).toString(16)}:${(((v4[2] ?? 0) << 8) | (v4[3] ?? 0)).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    bytes.push(n >> 8, n & 0xff);
  }
  return bytes;
}

function isBlockedIPv4(b: number[]): boolean {
  const [a = 0, b1 = 0, c = 0] = b;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10/8
    (a === 100 && (b1 & 0xc0) === 64) || // 100.64/10 (CGNAT)
    a === 127 || // loopback
    (a === 169 && b1 === 254) || // link-local + metadata de nuvem (169.254.169.254)
    (a === 172 && (b1 & 0xf0) === 16) || // 172.16/12
    (a === 192 && b1 === 0 && c === 0) || // 192.0.0/24
    (a === 192 && b1 === 0 && c === 2) || // TEST-NET-1
    (a === 192 && b1 === 88 && c === 99) || // 6to4 relay
    (a === 192 && b1 === 168) || // 192.168/16
    (a === 198 && (b1 === 18 || b1 === 19)) || // benchmark
    (a === 198 && b1 === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b1 === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast, reservado e broadcast
  );
}

function isBlockedIPv6(b: number[]): boolean {
  const first12Zero = b.slice(0, 10).every((x) => x === 0) && b[10] === 0 && b[11] === 0;
  if (first12Zero) return true; // ::, ::1 e IPv4-compatível (::a.b.c.d)
  // ::ffff:a.b.c.d (IPv4-mapeado) -> avalia o IPv4 embutido
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) return isBlockedIPv4(b.slice(12, 16));
  // 64:ff9b::/96 (NAT64) -> avalia o IPv4 embutido; 64:ff9b:1::/48 é de uso local
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) {
    if (b.slice(4, 12).every((x) => x === 0)) return isBlockedIPv4(b.slice(12, 16));
    return true;
  }
  // 2002::/16 (6to4) -> avalia o IPv4 embutido
  if (b[0] === 0x20 && b[1] === 0x02) return isBlockedIPv4(b.slice(2, 6));
  // somente unicast global 2000::/3 é permitido...
  if (((b[0] ?? 0) & 0xe0) !== 0x20) return true; // fc00::/7, fe80::/10, ff00::/8, 100::/64 etc.
  // ...exceto sub-faixas especiais
  if (b[0] === 0x20 && b[1] === 0x01 && (b[2] ?? 0) < 0x02) return true; // 2001::/23 (Teredo, protocolo IETF)
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // 2001:db8::/32 (documentação)
  if (b[0] === 0x3f && b[1] === 0xff && ((b[2] ?? 0) & 0xf0) === 0) return true; // 3fff::/20 (documentação)
  return false;
}

/** true se o IP (literal) é privado/loopback/link-local/reservado — ou inválido (falha fechada). */
export function isBlockedIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, '');
  const family = net.isIP(clean);
  if (family === 4) {
    const b = parseIPv4(clean);
    return b ? isBlockedIPv4(b) : true;
  }
  if (family === 6) {
    const b = parseIPv6(clean);
    return b ? isBlockedIPv6(b) : true;
  }
  return true;
}

// ---- Validação de URL -------------------------------------------------------------

const BLOCKED_HOSTNAME_RE = /(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/;

export const defaultResolver: Resolver = async (hostname) => {
  const res = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return res.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
};

let testAllowPrivate: AllowPrivate = false;
/** SOMENTE TESTES: libera destinos privados por padrão (ex.: simuladores em localhost). Recusado em produção. */
export function setSsrfAllowPrivateForTests(value: AllowPrivate): void {
  if (env.isProduction) throw new Error('allowPrivate é proibido em produção');
  testAllowPrivate = value;
}

function privateAllowed(opt: AllowPrivate | undefined, hostname: string): boolean {
  const effective = opt ?? testAllowPrivate;
  if (!effective) return false;
  if (env.isProduction) throw new Error('allowPrivate é proibido em produção');
  return typeof effective === 'function' ? effective(hostname) : true;
}

export function hostMatches(hostname: string, allowedHosts: string[]): boolean {
  const h = hostname.toLowerCase();
  return allowedHosts.some((raw) => {
    const a = raw.trim().toLowerCase();
    if (a.startsWith('*.')) return h.endsWith(a.slice(1)) && h.length > a.length - 1;
    return h === a;
  });
}

export interface SafeUrlOptions {
  /** Se informado, o hostname (de cada salto) precisa estar na lista. Aceita "*.exemplo.com". */
  allowedHosts?: string[];
  allowPrivate?: AllowPrivate;
  resolver?: Resolver;
}

export interface SafeUrl {
  url: URL;
  hostname: string;
  /** Endereços já validados (usados para fixar a conexão). */
  addresses: ResolvedAddress[];
}

export async function assertSafeUrl(input: string | URL, opts: SafeUrlOptions = {}): Promise<SafeUrl> {
  let url: URL;
  try {
    url = typeof input === 'string' ? new URL(input) : new URL(input.href);
  } catch {
    throw new SsrfBlockedError('URL inválida');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new SsrfBlockedError(`esquema não permitido: ${url.protocol}`);
  if (url.username || url.password) throw new SsrfBlockedError('URL com credenciais embutidas não é permitida');

  // O parser WHATWG já normaliza IPs obfuscados (2130706433, 0x7f.1, 017700000001) para decimal pontuado.
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!hostname) throw new SsrfBlockedError('URL sem host');
  if (opts.allowedHosts && !hostMatches(hostname, opts.allowedHosts)) throw new SsrfBlockedError(`host não permitido: ${hostname}`);

  const allowPrivate = privateAllowed(opts.allowPrivate, hostname);
  let addresses: ResolvedAddress[];
  const literal = net.isIP(hostname);
  if (literal) {
    addresses = [{ address: hostname, family: literal === 6 ? 6 : 4 }];
  } else {
    if (!allowPrivate && BLOCKED_HOSTNAME_RE.test(hostname)) throw new SsrfBlockedError(`host interno não permitido: ${hostname}`);
    try {
      addresses = await (opts.resolver ?? defaultResolver)(hostname);
    } catch {
      throw new SsrfBlockedError(`falha ao resolver o host: ${hostname}`);
    }
    if (addresses.length === 0) throw new SsrfBlockedError(`host sem endereço: ${hostname}`);
  }

  if (!allowPrivate) {
    // TODOS os endereços precisam ser públicos (um único privado já bloqueia)
    const bad = addresses.find((a) => isBlockedIp(a.address));
    if (bad) throw new SsrfBlockedError(`destino bloqueado (${hostname} -> endereço não público)`);
  }
  return { url, hostname, addresses };
}

// ---- Fetch seguro -----------------------------------------------------------------

export interface SafeFetchOptions extends SafeUrlOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Prazo total (DNS + todos os saltos + leitura). Padrão 10s. */
  timeoutMs?: number;
  /** Máximo de bytes do corpo. Padrão 2 MiB. */
  maxBytes?: number;
  /** Máximo de redirecionamentos seguidos. Padrão 5. */
  maxRedirects?: number;
  /** false => devolve a resposta 3xx sem seguir. Padrão true. */
  followRedirects?: boolean;
  signal?: AbortSignal;
}

export interface SafeFetchResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  /** URL final (após redirecionamentos). */
  url: string;
  /** URLs intermediárias visitadas, em ordem (sem a final). */
  redirects: string[];
  text(): string;
  json<T = unknown>(): T;
}

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const SENSITIVE_ON_CROSS_ORIGIN = ['authorization', 'cookie', 'proxy-authorization'];

function pinnedLookup(addresses: ResolvedAddress[]) {
  // Retorna sempre os IPs já validados; nenhuma nova resolução DNS acontece na conexão.
  return (_hostname: string, options: { all?: boolean }, cb: (...args: unknown[]) => void) => {
    if (options?.all) cb(null, addresses.map((a) => ({ address: a.address, family: a.family })));
    else {
      const a = addresses[0] as ResolvedAddress;
      cb(null, a.address, a.family);
    }
  };
}

/** Descarta o corpo sem deixar o evento 'error' (AbortError) escapar como exceção não tratada. */
function discard(body: Readable): void {
  body.on('error', () => undefined);
  body.destroy();
}

async function readLimited(body: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buf.length;
    if (total > maxBytes) {
      discard(body);
      throw new ResponseTooLargeError(maxBytes);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function raceAbort<T>(p: Promise<T>, signal: AbortSignal, onAbort: () => Error): Promise<T> {
  if (signal.aborted) return Promise.reject(onAbort());
  return new Promise<T>((resolve, reject) => {
    const handler = () => reject(onAbort());
    signal.addEventListener('abort', handler, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener('abort', handler));
  });
}

export async function safeFetch(input: string | URL, opts: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 5;
  const follow = opts.followRedirects ?? true;

  const timeoutCtl = new AbortController();
  const timer = setTimeout(() => timeoutCtl.abort(), timeoutMs);
  const signal = opts.signal ? AbortSignal.any([timeoutCtl.signal, opts.signal]) : timeoutCtl.signal;
  const timeoutError = () => (opts.signal?.aborted ? new SafeFetchError('ABORTED', 'requisição cancelada') : new SafeFetchTimeoutError(timeoutMs));

  let method = (opts.method ?? 'GET').toUpperCase();
  let body = opts.body;
  let headers: Record<string, string> = {
    'user-agent': 'AchadosVIP/1.0',
    'accept-encoding': 'identity',
    ...Object.fromEntries(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
  };
  const redirects: string[] = [];
  let current: string | URL = input;

  try {
    for (let hop = 0; ; hop++) {
      const safe = await raceAbort(assertSafeUrl(current, opts), signal, timeoutError);
      const agent = new Agent({
        connect: { lookup: pinnedLookup(safe.addresses) as never, timeout: timeoutMs },
        connections: 1,
        pipelining: 0,
      });
      try {
        // raceAbort: o timeout vale também durante a conexão TCP (o agent é destruído no finally)
        const res = await raceAbort(
          request(safe.url, {
            method: method as 'GET',
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : body,
            dispatcher: agent,
            signal,
            headersTimeout: timeoutMs,
            bodyTimeout: timeoutMs,
          }),
          signal,
          timeoutError,
        );
        const location = res.headers.location;
        if (follow && REDIRECT_STATUS.has(res.statusCode) && typeof location === 'string' && location) {
          discard(res.body);
          if (hop >= maxRedirects) throw new TooManyRedirectsError(maxRedirects);
          let next: URL;
          try {
            next = new URL(location, safe.url);
          } catch {
            throw new SsrfBlockedError('cabeçalho Location inválido');
          }
          redirects.push(safe.url.href);
          if (next.origin !== safe.url.origin) headers = Object.fromEntries(Object.entries(headers).filter(([k]) => !SENSITIVE_ON_CROSS_ORIGIN.includes(k)));
          if (res.statusCode === 303 || ((res.statusCode === 301 || res.statusCode === 302) && method === 'POST')) {
            method = method === 'HEAD' ? 'HEAD' : 'GET';
            body = undefined;
            headers = Object.fromEntries(Object.entries(headers).filter(([k]) => !['content-type', 'content-length'].includes(k)));
          }
          current = next;
          continue; // revalida o próximo salto no topo do laço
        }
        const contentLength = Number(res.headers['content-length']);
        // HEAD não tem corpo: o Content-Length descreve o corpo do GET equivalente e nada será lido
        if (method !== 'HEAD' && Number.isFinite(contentLength) && contentLength > maxBytes) {
          discard(res.body);
          throw new ResponseTooLargeError(maxBytes);
        }
        const buf = method === 'HEAD' ? Buffer.alloc(0) : await readLimited(res.body, maxBytes);
        const outHeaders = res.headers as Record<string, string | string[] | undefined>;
        return {
          status: res.statusCode,
          headers: outHeaders,
          body: buf,
          url: safe.url.href,
          redirects,
          text: () => buf.toString('utf8'),
          json: <T>() => JSON.parse(buf.toString('utf8')) as T,
        };
      } finally {
        agent.destroy().catch(() => undefined);
      }
    }
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    if (signal.aborted) throw timeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
