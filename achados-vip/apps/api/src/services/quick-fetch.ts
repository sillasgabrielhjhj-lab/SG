/**
 * Lógica do "Gerar post" compartilhada entre a rota do painel (routes/quick.ts) e o mini servidor (quick-server.ts).
 * Sem banco de dados: recebe as configurações por parâmetro.
 */
import type { Settings } from '../domain/settings.js';
import { AppError } from '../lib/errors.js';
import { assertSafeUrl, safeFetch, SafeFetchError, SsrfBlockedError, type Resolver } from '../lib/ssrf.js';
import { buildQuickPost, checkQuickUrl, IMAGE_HOSTS, parseProductHtml, toCents, type ProductInfo } from './quick-post.js';

/** Só para testes: resolver DNS falso (os testes não acessam a internet). */
export const quickDeps: { resolver?: Resolver | undefined } = {};
const dns = () => (quickDeps.resolver ? { resolver: quickDeps.resolver } : {});

const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export interface PreviewInput {
  url: string;
  title?: string | undefined;
  price?: string | number | undefined; // em reais: "199,90" ou 199.9
  originalPrice?: string | number | undefined;
  couponCode?: string | undefined;
  imageUrl?: string | undefined;
}

async function readProduct(url: string, hosts: string[]): Promise<{ info: ProductInfo | null; error?: string }> {
  try {
    const res = await safeFetch(url, {
      allowedHosts: [...hosts, '*.mercadolivre.com.br', '*.mercadolibre.com'],
      timeoutMs: 8000,
      maxBytes: 1_500_000,
      headers: { accept: 'text/html', 'accept-language': 'pt-BR,pt;q=0.9' },
      ...dns(),
    });
    if (res.status >= 400) return { info: null, error: `A página do produto respondeu HTTP ${res.status}.` };
    return { info: parseProductHtml(res.text()) };
  } catch (err) {
    const why = err instanceof SsrfBlockedError ? 'endereço bloqueado por segurança' : err instanceof SafeFetchError ? err.message : 'falha de rede';
    return { info: null, error: `Não consegui abrir a página do produto (${why}).` };
  }
}

export async function buildPreview(body: PreviewInput, settings: Settings) {
  const urlError = checkQuickUrl(body.url, settings);
  if (urlError) throw new AppError(400, 'INVALID_LINK', `Link não aceito: ${urlError}`);

  const manualTitle = blank(body.title) ? null : String(body.title).trim();
  const manualPrice = blank(body.price) ? null : toCents(body.price);
  if (!blank(body.price) && manualPrice === null) throw new AppError(400, 'INVALID_PRICE', 'Preço inválido. Use algo como 199,90.');
  const manualOriginal = blank(body.originalPrice) ? null : toCents(body.originalPrice);
  if (!blank(body.originalPrice) && manualOriginal === null) throw new AppError(400, 'INVALID_PRICE', 'Preço original inválido. Use algo como 249,90.');

  const warnings: string[] = [];
  let page: ProductInfo | null = null;
  if (manualTitle === null || manualPrice === null || blank(body.imageUrl)) {
    const r = await readProduct(body.url, settings.affiliate.allowedHosts);
    page = r.info;
    if (r.error) warnings.push(r.error);
  }
  const title = manualTitle ?? page?.title ?? null;
  const priceCents = manualPrice ?? page?.priceCents ?? null;
  const rawImage = blank(body.imageUrl) ? (page?.imageUrl ?? null) : String(body.imageUrl);
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      const u = new URL(rawImage);
      if (u.protocol === 'https:' && IMAGE_HOSTS.some((h) => (h.startsWith('*.') ? u.hostname.endsWith(h.slice(1)) : u.hostname === h))) imageUrl = u.toString();
      else warnings.push('A imagem informada não é do site do Mercado Livre e foi ignorada.');
    } catch {
      warnings.push('URL de imagem inválida.');
    }
  }

  const found = { title: title !== null, price: priceCents !== null, image: imageUrl !== null };
  const needsInput = [!found.title ? 'title' : null, !found.price ? 'price' : null].filter(Boolean) as string[];
  if (needsInput.length > 0) {
    return { ok: false, needsInput, found, warnings, title, priceCents, imageUrl, whatsapp: null, telegram: null, discountPct: null };
  }
  const post = buildQuickPost({ url: body.url, title: title!, priceCents: priceCents!, originalPriceCents: manualOriginal, couponCode: body.couponCode ?? null }, settings);
  return { ok: true, needsInput: [], found, title, priceCents, originalPriceCents: manualOriginal, imageUrl, ...post, warnings: [...warnings, ...post.warnings] };
}

/** Baixa a imagem do CDN do ML (somente hosts permitidos). */
export async function fetchProductImage(url: string): Promise<{ type: string; ext: string; body: Buffer }> {
  try {
    await assertSafeUrl(url, { allowedHosts: IMAGE_HOSTS, ...dns() });
    const res = await safeFetch(url, { allowedHosts: IMAGE_HOSTS, timeoutMs: 8000, maxBytes: 5 * 1024 * 1024, ...dns() });
    const type = String(res.headers['content-type'] ?? '');
    if (res.status !== 200 || !type.startsWith('image/')) throw new AppError(502, 'IMAGE_UNAVAILABLE', 'Imagem indisponível.');
    return { type, ext: type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg', body: res.body };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, 'IMAGE_BLOCKED', 'Não foi possível obter a imagem (host não permitido ou indisponível).');
  }
}
