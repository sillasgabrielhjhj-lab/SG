import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError, parseInput } from '../lib/errors.js';
import { assertSafeUrl, safeFetch, SafeFetchError, SsrfBlockedError, type Resolver } from '../lib/ssrf.js';
import { requireAuth } from '../services/auth.js';
import { logEvent } from '../services/logs.js';
import { buildQuickPost, checkQuickUrl, IMAGE_HOSTS, parseProductHtml, toCents, type ProductInfo } from '../services/quick-post.js';
import { getSettings } from '../services/settings.js';

const PreviewBody = z.strictObject({
  url: z.string().trim().min(8).max(2048),
  title: z.string().trim().max(300).optional(),
  price: z.union([z.string(), z.number()]).optional(), // em reais: "199,90" ou 199.9
  originalPrice: z.union([z.string(), z.number()]).optional(),
  couponCode: z.string().trim().max(60).optional(),
  imageUrl: z.string().trim().max(2048).optional(),
});
const ImageQuery = z.object({ url: z.string().trim().min(8).max(2048), download: z.coerce.boolean().optional() });

/** Só para testes: resolver DNS falso (os testes não acessam a internet). */
export const quickDeps: { resolver?: Resolver } = {};
const dns = () => (quickDeps.resolver ? { resolver: quickDeps.resolver } : {});

const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

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

export default async function (app: FastifyInstance) {
  app.post('/api/quick/preview', { schema: { tags: ['quick'], summary: 'Gera texto (WhatsApp/Telegram) e imagem a partir do seu link de afiliado', docs: { body: PreviewBody } } }, async (request) => {
    const auth = requireAuth(request);
    const body = parseInput(PreviewBody, request.body);
    const settings = await getSettings();
    const urlError = checkQuickUrl(body.url, settings);
    if (urlError) throw new AppError(400, 'INVALID_LINK', `Link não aceito: ${urlError}`);

    const manualTitle = blank(body.title) ? null : body.title!.trim();
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
    const rawImage = blank(body.imageUrl) ? (page?.imageUrl ?? null) : body.imageUrl!;
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
    await logEvent('INFO', 'quick', 'Post gerado', { userId: auth.user.id, found, host: new URL(body.url).hostname });
    if (needsInput.length > 0) {
      return { ok: false, needsInput, found, warnings, title, priceCents, imageUrl, whatsapp: null, telegram: null, discountPct: null };
    }
    const post = buildQuickPost(
      { url: body.url, title: title!, priceCents: priceCents!, originalPriceCents: manualOriginal, couponCode: body.couponCode ?? null },
      settings,
    );
    return { ok: true, needsInput: [], found, title, priceCents, originalPriceCents: manualOriginal, imageUrl, ...post, warnings: [...warnings, ...post.warnings] };
  });

  // Proxy da imagem (CDN do ML): permite baixar o arquivo com um clique, sem depender de CORS do navegador.
  app.get('/api/quick/image', { schema: { tags: ['quick'], summary: 'Baixa a imagem do produto (somente CDN do Mercado Livre)', docs: { querystring: ImageQuery } } }, async (request, reply) => {
    requireAuth(request);
    const q = parseInput(ImageQuery, request.query);
    try {
      await assertSafeUrl(q.url, { allowedHosts: IMAGE_HOSTS, ...dns() });
      const res = await safeFetch(q.url, { allowedHosts: IMAGE_HOSTS, timeoutMs: 8000, maxBytes: 5 * 1024 * 1024, ...dns() });
      const type = String(res.headers['content-type'] ?? '');
      if (res.status !== 200 || !type.startsWith('image/')) throw new AppError(502, 'IMAGE_UNAVAILABLE', 'Imagem indisponível.');
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      reply.header('content-type', type).header('cache-control', 'private, max-age=3600');
      if (q.download) reply.header('content-disposition', `attachment; filename="produto.${ext}"`);
      return reply.send(res.body);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(400, 'IMAGE_BLOCKED', 'Não foi possível obter a imagem (host não permitido ou indisponível).');
    }
  });
}
