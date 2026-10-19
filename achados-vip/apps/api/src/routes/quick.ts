import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseInput } from '../lib/errors.js';
import { requireAuth } from '../services/auth.js';
import { logEvent } from '../services/logs.js';
import { buildPreview, fetchProductImage, quickDeps } from '../services/quick-fetch.js';
import { getSettings } from '../services/settings.js';

export { quickDeps }; // usado pelos testes (resolver DNS falso)

const PreviewBody = z.strictObject({
  url: z.string().trim().min(8).max(2048),
  title: z.string().trim().max(300).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  originalPrice: z.union([z.string(), z.number()]).optional(),
  couponCode: z.string().trim().max(60).optional(),
  imageUrl: z.string().trim().max(2048).optional(),
});
const ImageQuery = z.object({ url: z.string().trim().min(8).max(2048), download: z.coerce.boolean().optional() });

export default async function (app: FastifyInstance) {
  app.post('/api/quick/preview', { schema: { tags: ['quick'], summary: 'Gera texto (WhatsApp/Telegram) e imagem a partir do seu link de afiliado', docs: { body: PreviewBody } } }, async (request) => {
    const auth = requireAuth(request);
    const result = await buildPreview(parseInput(PreviewBody, request.body), await getSettings());
    await logEvent('INFO', 'quick', 'Post gerado', { userId: auth.user.id, found: result.found });
    return result;
  });

  // Proxy da imagem (CDN do ML): permite baixar o arquivo com um clique, sem depender de CORS do navegador.
  app.get('/api/quick/image', { schema: { tags: ['quick'], summary: 'Baixa a imagem do produto (somente CDN do Mercado Livre)', docs: { querystring: ImageQuery } } }, async (request, reply) => {
    requireAuth(request);
    const q = parseInput(ImageQuery, request.query);
    const img = await fetchProductImage(q.url);
    reply.header('content-type', img.type).header('cache-control', 'private, max-age=3600');
    if (q.download) reply.header('content-disposition', `attachment; filename="produto.${img.ext}"`);
    return reply.send(img.body);
  });
}
