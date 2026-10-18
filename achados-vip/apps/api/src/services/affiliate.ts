/**
 * AffiliateLinkService — links de afiliado: cadastro, importação em lote e VALIDAÇÃO.
 * O sistema NUNCA gera nem altera URLs de afiliado e não anexa tags (não há API oficial de geração).
 *
 * POLÍTICA DE VALIDAÇÃO (nunca VALIDATED sem confirmação):
 *  1. Forma: https, host em settings.affiliate.allowedHosts, sem credenciais/IP/porta fora do padrão. Falhou => INVALID.
 *  2. Produto da fonte 'fixture' em produção => INVALID (dado de teste nunca é publicável).
 *  3. Se a própria URL traz um id de anúncio e ele não é do produto => INVALID (sem rede).
 *  4. settings.affiliate.resolveRedirects = false: VALIDATED "apenas por formato" (host+forma), com essa nota explícita.
 *     É uma escolha consciente do administrador; o destino NÃO é confirmado.
 *  5. resolveRedirects = true (padrão): segue redirecionamentos (safeFetch: SSRF, timeout, tamanho) e extrai o id do destino
 *     (URL final, cadeia de redirecionamentos ou <link rel=canonical>/og:url). Compara com Product.externalId,
 *     catalogProductId e o id do permalink:
 *       igual => VALIDATED | diferente => INVALID | sem id identificável, HTTP 403/429/5xx, DNS/rede/timeout => PENDING
 *       ("não foi possível confirmar"; reexecute a validação) | 404/410, host final fora da lista, redirecionamentos demais => INVALID.
 *  Limite conhecido: não há API para provar que o link pertence à SUA conta de afiliado; validamos host + produto de destino.
 *  Revalidar um link já VALIDATED que falha por indisponibilidade transitória mantém a validação anterior (com aviso em lastError).
 */
import type { AffiliateLink, AffiliateLinkKind, AffiliateLinkStatus, Prisma, Product } from '@prisma/client';
import type { Settings } from '../domain/settings.js';
import { prisma } from '../lib/db.js';
import { env } from '../lib/env.js';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js';
import { redactUrl } from '../lib/http.js';
import { pageParams, pageResult, type Page } from '../lib/pagination.js';
import { safeFetch, SafeFetchError, SsrfBlockedError, type SafeFetchOptions, type SafeFetchResponse } from '../lib/ssrf.js';
import { checkAffiliateUrlShape, extractMlItemId } from './affiliate-url.js';
import { logEvent } from './logs.js';
import { getSettings } from './settings.js';

export const MAX_IMPORT_LINES = 1000;
const MAX_URL_LENGTH = 2048;
export const FORMAT_ONLY_NOTE = 'Validado apenas por formato (https + host permitido). O destino do link NÃO foi confirmado.';
const RESOLVE_TIMEOUT_MS = 8000;
const BODY_LIMIT_BYTES = 3 * 1024 * 1024;
const VALIDATE_CONCURRENCY = 3;

/** Subconjunto de safeFetch usado aqui (injetável nos testes). */
export type Fetcher = (url: string, opts: SafeFetchOptions) => Promise<Pick<SafeFetchResponse, 'status' | 'headers' | 'url' | 'redirects' | 'text'>>;
export interface AffiliateDeps {
  fetcher?: Fetcher;
  now?: Date;
}

// ---------- DTO ----------

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

export const toAffiliateLinkDTO = (l: AffiliateLink & { product: { title: string } }): AffiliateLinkDTO => ({
  id: l.id,
  productId: l.productId,
  productTitle: l.product.title,
  url: l.url,
  kind: l.kind,
  status: l.status,
  validatedAt: l.validatedAt ? l.validatedAt.toISOString() : null,
  validationNote: l.validationNote,
  lastError: l.lastError,
  createdAt: l.createdAt.toISOString(),
});

export async function getLinkDTO(linkId: string): Promise<AffiliateLinkDTO> {
  const l = await prisma.affiliateLink.findUnique({ where: { id: linkId }, include: { product: { select: { title: true } } } });
  if (!l) throw new NotFoundError('Link de afiliado não encontrado.');
  return toAffiliateLinkDTO(l);
}

/** Contagem por status (para /api/affiliate/status). */
export async function countLinksByStatus(): Promise<{ pending: number; validated: number; invalid: number }> {
  const rows = await prisma.affiliateLink.groupBy({ by: ['status'], _count: { _all: true } });
  const n = (s: AffiliateLinkStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { pending: n('PENDING'), validated: n('VALIDATED'), invalid: n('INVALID') };
}

// ---------- resolução do destino ----------

interface Verdict {
  status: AffiliateLinkStatus;
  note: string;
  error?: string;
  resolvedItemId?: string;
}

const verdict = (status: AffiliateLinkStatus, note: string, extra: Partial<Verdict> = {}): Verdict => ({ status, note, ...extra });

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

/** URL canônica da página (<link rel=canonical> ou og:url), se houver. */
export function findCanonicalUrl(html: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (/rel\s*=\s*["']?canonical/i.test(tag)) {
      const href = attr(tag, 'href');
      if (href) return href;
    }
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (/property\s*=\s*["']og:url["']/i.test(tag)) {
      const content = attr(tag, 'content');
      if (content) return content;
    }
  }
  return null;
}

interface Destination {
  status: number;
  finalUrl: string;
  hops: number;
  itemId: string | null;
}

function inspect(res: Awaited<ReturnType<Fetcher>>, readBody: boolean): Destination {
  const chain = [...res.redirects, res.url];
  let itemId = extractMlItemId(res.url);
  if (!itemId && readBody && res.status >= 200 && res.status < 300 && /html/i.test(String(res.headers['content-type'] ?? 'html'))) {
    const canonical = findCanonicalUrl(res.text());
    if (canonical) itemId = extractMlItemId(canonical);
  }
  if (!itemId) for (const u of chain) if ((itemId = extractMlItemId(u))) break;
  return { status: res.status, finalUrl: res.url, hops: res.redirects.length, itemId };
}

async function resolveDestination(url: string, fetcher: Fetcher): Promise<Destination> {
  const base = { timeoutMs: RESOLVE_TIMEOUT_MS, maxRedirects: 5 };
  const head = inspect(await fetcher(url, { ...base, method: 'HEAD', maxBytes: 64 * 1024 }), false);
  if (head.itemId || head.status === 404 || head.status === 410) return head;
  // HEAD costuma ser bloqueado ou não revela o produto: GET limitado e leitura de canonical/og:url
  return inspect(await fetcher(url, { ...base, method: 'GET', maxBytes: BODY_LIMIT_BYTES }), true);
}

const hostAllowed = (host: string, allowed: readonly string[]): boolean =>
  allowed.some((raw) => {
    const a = raw.trim().toLowerCase().replace(/^\*\./, '');
    return a !== '' && (host === a || host.endsWith(`.${a}`));
  });

function productIdSet(product: Pick<Product, 'externalId' | 'catalogProductId' | 'permalink'>): Set<string> {
  const ids = new Set<string>();
  const add = (v: string | null | undefined, fallbackToRaw: boolean) => {
    if (!v) return;
    const id = extractMlItemId(v) ?? (fallbackToRaw ? v : null);
    if (id) ids.add(id.toUpperCase());
  };
  add(product.externalId, true);
  add(product.catalogProductId, true);
  add(product.permalink, false);
  return ids;
}

async function evaluate(url: string, product: Product, settings: Settings, deps: AffiliateDeps): Promise<Verdict> {
  const shape = checkAffiliateUrlShape(url, settings.affiliate.allowedHosts);
  if (!shape.ok) return verdict('INVALID', `Formato/host inválido: ${shape.reason}`, { error: shape.reason ?? 'URL inválida' });

  if (product.source === 'fixture' && env.isProduction) {
    return verdict('INVALID', 'Produto de TESTE (fixture): não pode ter link validado em produção.', { error: 'produto de teste' });
  }

  const known = productIdSet(product);
  const ownId = extractMlItemId(url);
  if (ownId && !known.has(ownId)) {
    return verdict('INVALID', `A URL aponta para o anúncio ${ownId}, mas o produto é ${product.externalId}.`, { error: 'produto diferente', resolvedItemId: ownId });
  }

  if (!settings.affiliate.resolveRedirects) return verdict('VALIDATED', FORMAT_ONLY_NOTE, ownId ? { resolvedItemId: ownId } : {});

  const fetcher: Fetcher = deps.fetcher ?? ((u, o) => safeFetch(u, o));
  let dest: Destination;
  try {
    dest = await resolveDestination(url, fetcher);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erro desconhecido';
    if (err instanceof SafeFetchError && err.code === 'TOO_MANY_REDIRECTS') return verdict('INVALID', 'O link faz redirecionamentos demais.', { error: msg });
    if (err instanceof SsrfBlockedError && !/falha ao resolver/i.test(msg)) {
      return verdict('INVALID', 'O link redireciona para um destino bloqueado por segurança.', { error: msg });
    }
    // DNS, conexão, timeout, resposta grande: sem rede não há confirmação
    return verdict('PENDING', 'Não foi possível confirmar o destino do link (rede indisponível ou sem resposta). Tente validar novamente.', { error: msg });
  }

  const finalHost = new URL(dest.finalUrl).hostname.toLowerCase();
  if (!hostAllowed(finalHost, settings.affiliate.allowedHosts)) {
    return verdict('INVALID', `O link termina em um host fora da lista permitida (${finalHost}).`, { error: 'host de destino não permitido' });
  }
  if (dest.status === 404 || dest.status === 410) {
    return verdict('INVALID', `O destino do link retornou HTTP ${dest.status}.`, { error: `HTTP ${dest.status}` });
  }
  if (dest.status < 200 || dest.status >= 300) {
    return verdict('PENDING', `Não foi possível confirmar o destino (HTTP ${dest.status}). Tente validar novamente.`, { error: `HTTP ${dest.status}` });
  }
  if (!dest.itemId) {
    return verdict('PENDING', 'O link abriu, mas não foi possível identificar o produto de destino. Não foi confirmado.', { error: 'destino sem id de anúncio identificável' });
  }
  if (!known.has(dest.itemId)) {
    return verdict('INVALID', `O destino do link é outro produto (${dest.itemId}), não ${product.externalId}.`, { error: 'produto diferente', resolvedItemId: dest.itemId });
  }
  return verdict('VALIDATED', `Destino confirmado: ${dest.itemId} (${dest.hops} redirecionamento(s)). Não é verificado se o link pertence à sua conta de afiliado.`, { resolvedItemId: dest.itemId });
}

// ---------- API do serviço ----------

export async function validateLink(linkId: string, deps: AffiliateDeps = {}): Promise<AffiliateLink> {
  const link = await prisma.affiliateLink.findUnique({ where: { id: linkId }, include: { product: true } });
  if (!link) throw new NotFoundError('Link de afiliado não encontrado.');
  const settings = await getSettings();
  let v: Verdict;
  try {
    v = await evaluate(link.url, link.product, settings, deps);
  } catch (err) {
    v = verdict('PENDING', 'Erro inesperado ao validar o link; nada foi confirmado.', { error: err instanceof Error ? err.message : 'erro' });
  }

  // revalidação que falhou só por indisponibilidade: preserva a confirmação anterior (se foi uma confirmação real)
  const keepPrevious = v.status === 'PENDING' && link.status === 'VALIDATED' && !link.validationNote?.startsWith('Validado apenas por formato');
  const now = deps.now ?? new Date();
  const updated = await prisma.affiliateLink.update({
    where: { id: link.id },
    data: keepPrevious
      ? { lastError: v.error ?? null, validationNote: `${link.validationNote ?? ''} (Revalidação em ${now.toISOString()} não concluiu: ${v.error ?? 'sem detalhe'}; mantida a validação anterior.)`.slice(0, 1000) }
      : {
          status: v.status,
          resolvedItemId: v.resolvedItemId ?? null,
          validatedAt: v.status === 'VALIDATED' ? now : null,
          validationNote: v.note,
          lastError: v.status === 'VALIDATED' ? null : (v.error ?? null),
        },
  });
  await logEvent(updated.status === 'VALIDATED' ? 'INFO' : 'WARN', 'affiliate', `Link ${updated.status}: ${v.note}`, { linkId: updated.id, productId: updated.productId, url: redactUrl(updated.url), erro: v.error });
  return updated;
}

/** Cria o link (PENDING) e já tenta validar. Mesmo (produto, URL) não duplica: reaproveita e revalida. */
export async function addLink(productId: string, url: string, createdBy?: string, opts: AffiliateDeps & { kind?: AffiliateLinkKind } = {}): Promise<AffiliateLink> {
  const clean = (url ?? '').trim();
  if (!clean) throw new ValidationError('Informe a URL do link de afiliado.');
  if (clean.length > MAX_URL_LENGTH * 2) throw new ValidationError('URL longa demais.');
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new NotFoundError('Produto não encontrado.');
  const existing = await prisma.affiliateLink.findFirst({ where: { productId, url: clean } });
  const link =
    existing ??
    (await prisma.affiliateLink.create({ data: { productId, url: clean, kind: opts.kind ?? 'MANUAL', status: 'PENDING', createdBy: createdBy ?? null } }));
  return validateLink(link.id, opts);
}

export async function getValidatedLink(productId: string): Promise<AffiliateLink | null> {
  const settings = await getSettings();
  const links = await prisma.affiliateLink.findMany({
    where: { productId, status: 'VALIDATED' },
    orderBy: [{ validatedAt: 'desc' }, { createdAt: 'desc' }],
    include: { product: { select: { source: true } } },
  });
  for (const l of links) {
    // defesa em profundidade: o host precisa continuar permitido e fixture nunca é publicável em produção
    if (!checkAffiliateUrlShape(l.url, settings.affiliate.allowedHosts).ok) continue;
    if (env.isProduction && l.product.source === 'fixture') continue;
    const { product: _product, ...link } = l;
    return link;
  }
  return null;
}

/** Quais produtos têm link VALIDADO utilizável (mesmas regras de getValidatedLink), em uma só consulta. */
export async function productsWithValidatedLink(productIds: readonly string[]): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const settings = await getSettings();
  const links = await prisma.affiliateLink.findMany({
    where: { productId: { in: [...productIds] }, status: 'VALIDATED' },
    select: { productId: true, url: true, product: { select: { source: true } } },
  });
  const ok = new Set<string>();
  for (const l of links) {
    if (!checkAffiliateUrlShape(l.url, settings.affiliate.allowedHosts).ok) continue;
    if (env.isProduction && l.product.source === 'fixture') continue;
    ok.add(l.productId);
  }
  return ok;
}

export async function deleteLink(linkId: string): Promise<void> {
  const link = await prisma.affiliateLink.findUnique({ where: { id: linkId }, select: { id: true } });
  if (!link) throw new NotFoundError('Link de afiliado não encontrado.');
  const used = await prisma.publication.count({ where: { affiliateLinkId: linkId } });
  if (used > 0) throw new ConflictError('Este link já foi usado em publicações e não pode ser excluído.', 'LINK_IN_USE');
  await prisma.affiliateLink.delete({ where: { id: linkId } });
}

export async function listLinks(q: { status?: AffiliateLinkStatus; productId?: string; page: number; pageSize: number }): Promise<Page<AffiliateLinkDTO>> {
  const where: Prisma.AffiliateLinkWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.productId ? { productId: q.productId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.affiliateLink.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { product: { select: { title: true } } }, ...pageParams(q) }),
    prisma.affiliateLink.count({ where }),
  ]);
  return pageResult(rows.map(toAffiliateLinkDTO), total, q);
}

// ---------- pendentes ----------

const PENDING_OFFER_STATUSES = ['DISCOVERED', 'APPROVED', 'QUEUED'] as const;

function pendingProductWhere(): Prisma.ProductWhereInput {
  return {
    status: 'ACTIVE',
    ...(env.isProduction ? { source: { not: 'fixture' } } : {}),
    offers: { some: { status: { in: [...PENDING_OFFER_STATUSES] } } },
    affiliateLinks: { none: { status: 'VALIDATED' } },
  };
}

export interface PendingProduct {
  productId: string;
  title: string;
  permalink: string;
  offerId?: string;
  score?: number;
}

/** Produtos com oferta qualificada/aprovada e SEM link validado (a melhor oferta de cada um, por score). */
export async function listPendingProducts(limit = 500): Promise<PendingProduct[]> {
  const offers = await prisma.offer.findMany({
    where: { status: { in: [...PENDING_OFFER_STATUSES] }, product: pendingProductWhere() },
    orderBy: [{ score: 'desc' }, { discoveredAt: 'desc' }],
    select: { id: true, score: true, product: { select: { id: true, title: true, permalink: true } } },
    take: limit * 3,
  });
  const seen = new Set<string>();
  const out: PendingProduct[] = [];
  for (const o of offers) {
    if (seen.has(o.product.id)) continue;
    seen.add(o.product.id);
    out.push({ productId: o.product.id, title: o.product.title, permalink: o.product.permalink, offerId: o.id, score: o.score });
    if (out.length >= limit) break;
  }
  return out;
}

export const countPendingProducts = (): Promise<number> => prisma.product.count({ where: pendingProductWhere() });

/** Evita injeção de fórmulas em planilhas: títulos vêm de terceiros. */
function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV `id;titulo;url_ml;score` (UTF-8 com BOM, separador `;`, para abrir direto no Excel pt-BR). */
export function pendingToCsv(rows: readonly PendingProduct[]): string {
  const lines = ['id;titulo;url_ml;score', ...rows.map((r) => [r.productId, r.title, r.permalink, r.score ?? ''].map(csvCell).join(';'))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

// ---------- importação em lote ----------

export interface ParsedImportLine {
  line: number;
  /** Referência ao produto: id interno ou id do anúncio/catálogo do ML. */
  ref?: { type: 'productId' | 'mlId'; value: string };
  url?: string;
  error?: string;
}

const MLB_RE = /^MLBU?-?\d+$/i;
const CUID_RE = /^c(?=[a-z]*\d)[a-z0-9]{20,32}$/i; // id interno (cuid): começa com 'c' e tem dígitos
const URL_RE = /^https?:\/\//i;

/** Divide uma linha CSV (aspas duplas, delimitador TAB > ';' > ','). */
function splitCells(line: string): string[] {
  const delim = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** Interpreta o texto colado/CSV. Ignora linhas vazias, comentários (#) e o cabeçalho; números de linha são os originais. */
export function parseImportText(text: string): ParsedImportLine[] {
  const out: ParsedImportLine[] = [];
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  let seenFirst = false;
  lines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const isFirst = !seenFirst;
    seenFirst = true;
    // cabeçalho: primeira linha útil sem URL nem id de anúncio
    if (isFirst && !/https?:\/\//i.test(trimmed) && !/MLBU?-?\d/i.test(trimmed)) return;

    const cells = splitCells(trimmed).filter((c) => c !== '');
    let affiliateIdx = -1;
    cells.forEach((c, i) => {
      if (URL_RE.test(c)) affiliateIdx = i;
    });
    if (affiliateIdx === -1) {
      out.push({ line, error: 'Linha sem URL de afiliado. Formato: "URL_ML ; URL_AFILIADO" ou "MLB123 ; URL_AFILIADO".' });
      return;
    }
    const url = cells[affiliateIdx]!;
    let ref: ParsedImportLine['ref'];
    for (const [i, c] of cells.entries()) {
      if (i === affiliateIdx) continue;
      if (CUID_RE.test(c)) {
        ref = { type: 'productId', value: c };
        break;
      }
      if (!ref) {
        const id = URL_RE.test(c) ? extractMlItemId(c) : MLB_RE.test(c) ? extractMlItemId(c) : null;
        if (id) ref = { type: 'mlId', value: id };
      }
    }
    if (!ref) {
      out.push({ line, url, error: 'Linha sem referência do produto (URL do Mercado Livre, MLB123 ou id do produto).' });
      return;
    }
    out.push({ line, ref, url });
  });
  return out;
}

export interface ImportResult {
  imported: number;
  validated: number;
  invalid: { line: number; reason: string }[];
  unmatched: { line: number; reason: string }[];
  /** Links que não puderam ser confirmados agora (PENDING). */
  pending: number;
  /** Linhas repetidas (mesmo produto e URL) ou já cadastradas. */
  duplicates: number;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function findProducts(ref: NonNullable<ParsedImportLine['ref']>): Promise<Product[]> {
  if (ref.type === 'productId') {
    const p = await prisma.product.findUnique({ where: { id: ref.value } });
    return p ? [p] : [];
  }
  const byListing = await prisma.product.findMany({ where: { externalId: ref.value } });
  if (byListing.length) return byListing;
  return prisma.product.findMany({ where: { catalogProductId: ref.value } });
}

export async function importBatch(text: string, createdBy?: string, deps: AffiliateDeps = {}): Promise<ImportResult> {
  const parsed = parseImportText(text ?? '');
  if (parsed.length > MAX_IMPORT_LINES) throw new ValidationError(`Limite de ${MAX_IMPORT_LINES} linhas por importação.`);
  const result: ImportResult = { imported: 0, validated: 0, invalid: [], unmatched: [], pending: 0, duplicates: 0 };

  const toValidate: { linkId: string; line: number; isNew: boolean }[] = [];
  const seen = new Set<string>();
  for (const p of parsed) {
    if (p.error || !p.ref || !p.url) {
      result.invalid.push({ line: p.line, reason: p.error ?? 'Linha inválida.' });
      continue;
    }
    if (p.url.length > MAX_URL_LENGTH * 2) {
      result.invalid.push({ line: p.line, reason: 'URL longa demais.' });
      continue;
    }
    const products = await findProducts(p.ref);
    if (products.length === 0) {
      result.unmatched.push({ line: p.line, reason: `Produto não encontrado para ${p.ref.value}. Ele precisa ter sido descoberto antes de receber um link.` });
      continue;
    }
    for (const product of products) {
      const key = `${product.id}|${p.url}`;
      if (seen.has(key)) {
        result.duplicates++;
        continue;
      }
      seen.add(key);
      const existing = await prisma.affiliateLink.findFirst({ where: { productId: product.id, url: p.url } });
      if (existing) {
        result.duplicates++;
        if (existing.status !== 'VALIDATED') toValidate.push({ linkId: existing.id, line: p.line, isNew: false });
        continue;
      }
      const created = await prisma.affiliateLink.create({ data: { productId: product.id, url: p.url, kind: 'IMPORTED', status: 'PENDING', createdBy: createdBy ?? null } });
      result.imported++;
      toValidate.push({ linkId: created.id, line: p.line, isNew: true });
    }
  }

  const outcomes = await mapLimit(toValidate, VALIDATE_CONCURRENCY, async (t) => ({ t, link: await validateLink(t.linkId, deps) }));
  for (const { t, link } of outcomes) {
    if (link.status === 'VALIDATED') result.validated++;
    else if (link.status === 'INVALID') result.invalid.push({ line: t.line, reason: link.lastError ?? link.validationNote ?? 'Link inválido.' });
    else result.pending++;
  }
  result.invalid.sort((a, b) => a.line - b.line);
  result.unmatched.sort((a, b) => a.line - b.line);
  await logEvent('INFO', 'affiliate', `Importação de links: ${result.imported} novos, ${result.validated} validados, ${result.invalid.length} inválidos, ${result.unmatched.length} sem produto, ${result.pending} pendentes.`);
  return result;
}
