import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseInput } from '../lib/errors.js';
import { PageQuerySchema } from '../lib/pagination.js';
import { requireAuth } from '../services/auth.js';
import { approveOffer, getOfferDetail, listOffers, publishOffer, rejectOffer } from '../services/offers.js';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const StatusEnum = z.enum(['DISCOVERED', 'APPROVED', 'REJECTED', 'QUEUED', 'PUBLISHED', 'EXPIRED', 'SUSPENDED']);

const ListQuery = PageQuerySchema.extend({
  /** Um status ou vários separados por vírgula (ex.: APPROVED,DISCOVERED). */
  status: z
    .preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : undefined), z.array(StatusEnum).optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  minScore: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100).optional()),
  q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
  sort: z.preprocess(emptyToUndefined, z.enum(['score', 'discoveredAt', 'discountPct']).default('discoveredAt')),
});
const IdParams = z.object({ id: z.string().min(1).max(64) });
const NoteBody = z.strictObject({ note: z.string().trim().max(500).optional() });
const PublishBody = z.strictObject({ channelId: z.string().min(1).max(64).optional() });

export default async function (app: FastifyInstance) {
  app.get('/api/offers', { schema: { tags: ['offers'], summary: 'Ofertas (filtros, ordenação e paginação)', docs: { querystring: ListQuery } } }, async (request) => {
    const q = parseInput(ListQuery, request.query);
    return listOffers({
      ...(q.status?.length ? { status: q.status } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.minScore !== undefined ? { minScore: q.minScore } : {}),
      ...(q.q ? { q: q.q } : {}),
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    });
  });

  app.get('/api/offers/:id', { schema: { tags: ['offers'], summary: 'Detalhe da oferta (histórico, links, publicações e prévia da mensagem)', docs: { params: IdParams } } }, async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return getOfferDetail(id);
  });

  app.post('/api/offers/:id/approve', { schema: { tags: ['offers'], summary: 'Aprova a oferta', docs: { body: NoteBody, params: IdParams } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    const body = parseInput(NoteBody, request.body ?? {});
    return approveOffer(id, auth.user.id, body.note);
  });

  app.post('/api/offers/:id/reject', { schema: { tags: ['offers'], summary: 'Rejeita a oferta', docs: { body: NoteBody, params: IdParams } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    const body = parseInput(NoteBody, request.body ?? {});
    return rejectOffer(id, auth.user.id, body.note);
  });

  app.post(
    '/api/offers/:id/publish',
    {
      schema: {
        tags: ['offers'],
        summary: 'Enfileira a publicação da oferta',
        description: 'Delegado ao serviço de publicação. 409 com `code` (NO_VALIDATED_LINK, OFFER_NOT_APPROVED, DUPLICATE, ...) quando uma regra bloqueia.',
        docs: { body: PublishBody, params: IdParams },
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const { id } = parseInput(IdParams, request.params);
      const body = parseInput(PublishBody, request.body ?? {});
      return publishOffer(id, { by: auth.user.id, ...(body.channelId ? { channelId: body.channelId } : {}) });
    },
  );
}
