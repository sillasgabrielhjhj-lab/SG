/**
 * "Gerar post": o admin cola o SEU link de afiliado e recebe texto + imagem do produto.
 * - O link do admin NUNCA é alterado: é exatamente o que vai na mensagem (só passa por validação de forma/host).
 * - Título, imagem e preço são lidos da página pública do produto (og:*, JSON-LD) quando disponíveis; o admin
 *   pode sempre preencher/corrigir manualmente. Nada é inventado: sem preço, não há texto.
 * - "De/Por" e % OFF só aparecem se o admin informar o preço original (dado dele, avisado como tal).
 */
import { calcDiscountPct } from '../domain/pricing.js';
import type { Settings } from '../domain/settings.js';
import { shortenTitle, formatMessage } from './message-formatter.js';
import { checkAffiliateUrlShape } from './affiliate-url.js';

export interface ProductInfo {
  title: string | null;
  imageUrl: string | null;
  priceCents: number | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Valor de <meta property|name|itemprop="chave" content="..."> em qualquer ordem de atributos. */
function metaContent(html: string, key: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const k = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (k?.toLowerCase() !== key) continue;
    const c = /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const v = (c?.[1] ?? c?.[2])?.trim();
    if (v) return decodeEntities(v);
  }
  return null;
}

function cleanTitle(raw: string): string {
  return decodeEntities(raw)
    .replace(/\s*[|\-–—]\s*Mercado\s?Livre.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aceita número ("199.9") ou texto pt-BR ("1.299,90"); devolve centavos ou null. */
export function toCents(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
  if (typeof value !== 'string') return null;
  let s = value.trim().replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // pt-BR
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function* ldNodes(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) for (const v of value) yield* ldNodes(v);
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    yield o;
    if (o['@graph']) yield* ldNodes(o['@graph']);
  }
}
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

function fromJsonLd(html: string): ProductInfo {
  const out: ProductInfo = { title: null, imageUrl: null, priceCents: null };
  const blocks = html.match(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const b of blocks) {
    const body = b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      continue;
    }
    for (const n of ldNodes(data)) {
      const type = String(first(n['@type']) ?? '');
      if (type !== 'Product') continue;
      if (!out.title && typeof n.name === 'string') out.title = cleanTitle(n.name);
      const img = first(n.image);
      if (!out.imageUrl) out.imageUrl = typeof img === 'string' ? img : typeof (img as { url?: unknown })?.url === 'string' ? (img as { url: string }).url : null;
      const offer = first(n.offers) as Record<string, unknown> | undefined;
      if (offer && out.priceCents === null) {
        const cur = offer.priceCurrency;
        if (cur === undefined || cur === 'BRL') out.priceCents = toCents(offer.price ?? offer.lowPrice);
      }
    }
  }
  return out;
}

/** Lê título, imagem e preço de uma página de produto (puro). Campos ausentes ficam null. */
export function parseProductHtml(html: string): ProductInfo {
  const ld = fromJsonLd(html);
  const ogTitle = metaContent(html, 'og:title');
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title = ld.title || (ogTitle ? cleanTitle(ogTitle) : null) || (titleTag ? cleanTitle(titleTag) : null) || null;
  const imageUrl = ld.imageUrl || metaContent(html, 'og:image') || metaContent(html, 'twitter:image');
  const cur = metaContent(html, 'product:price:currency') ?? metaContent(html, 'og:price:currency') ?? 'BRL';
  const metaPrice = cur === 'BRL' ? toCents(metaContent(html, 'product:price:amount') ?? metaContent(html, 'og:price:amount') ?? metaContent(html, 'price')) : null;
  const priceCents = ld.priceCents ?? metaPrice;
  return { title: title || null, imageUrl: imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : null, priceCents };
}

export interface QuickPostInput {
  url: string;
  title: string;
  priceCents: number;
  originalPriceCents?: number | null;
  couponCode?: string | null;
}
export interface QuickPostResult {
  whatsapp: string;
  telegram: string;
  discountPct: number | null;
  warnings: string[];
}

/** Valida o link do admin (forma/host) — sem alterá-lo. Devolve a mensagem de erro ou null. */
export function checkQuickUrl(url: string, settings: Settings): string | null {
  const r = checkAffiliateUrlShape(url, settings.affiliate.allowedHosts);
  return r.ok ? null : (r.reason ?? 'Link inválido.');
}

export function buildQuickPost(input: QuickPostInput, settings: Settings): QuickPostResult {
  const warnings: string[] = [];
  const orig = input.originalPriceCents ?? null;
  const pct = orig !== null ? calcDiscountPct(orig, input.priceCents) : null;
  if (orig !== null && pct === null) warnings.push('O preço original informado não é maior que o preço atual; o texto mostra só o preço atual.');
  if (pct !== null) warnings.push('"De/Por" e % de desconto usam o preço original que VOCÊ informou. Confira antes de publicar.');
  const msg = {
    title: shortenTitle(input.title),
    priceCents: input.priceCents,
    originalPriceCents: pct !== null ? orig : null,
    discountPct: pct,
    couponCode: input.couponCode?.trim() || null,
    affiliateUrl: input.url,
    kind: input.couponCode?.trim() ? ('COUPON' as const) : ('COMMON' as const),
    disclosure: settings.messages.disclosure,
  };
  return {
    whatsapp: formatMessage(msg, 'whatsapp'),
    telegram: formatMessage(msg, 'telegram_html'),
    discountPct: pct,
    warnings,
  };
}

/** Hosts de imagem aceitos (CDN do Mercado Livre). */
export const IMAGE_HOSTS = ['*.mlstatic.com', 'mlstatic.com'];
