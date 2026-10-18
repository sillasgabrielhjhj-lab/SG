import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseInput } from '../lib/errors.js';
import { PageQuerySchema } from '../lib/pagination.js';
import { requireAuth } from '../services/auth.js';
import {
  cancelPublication,
  getPublicationDetail,
  getPublicationDTO,
  listManualQueue,
  listPublications,
  markManualSent,
  retryPublication,
} from '../services/publishing.js';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const IdParams = z.object({ id: z.string().min(1).max(64) });
const ListQuery = PageQuerySchema.extend({
  status: z.preprocess(
    (v) => (typeof v === 'string' ? emptyToUndefined(v.trim().toUpperCase()) : v),
    z.enum(['PENDING', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'DEAD', 'MANUAL_READY', 'CANCELLED']).optional(),
  ),
  channelId: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
});

export default async function (app: FastifyInstance) {
  app.get('/api/publications', { schema: { tags: ['publications'], summary: 'Publicações (paginado)', docs: { querystring: ListQuery } } }, async (request) => {
    const q = parseInput(ListQuery, request.query);
    return listPublications({ page: q.page, pageSize: q.pageSize, ...(q.status ? { status: q.status } : {}), ...(q.channelId ? { channelId: q.channelId } : {}) });
  });

  // precisa vir antes de /:id
  app.get('/api/publications/manual-queue', { schema: { tags: ['publications'], summary: 'Fila manual (Modo B): mensagens prontas para publicar' } }, async () => listManualQueue());

  app.get('/api/publications/:id', { schema: { tags: ['publications'], summary: 'Detalhe com tentativas', docs: { params: IdParams } } }, async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return getPublicationDetail(id);
  });

  app.post('/api/publications/:id/retry', { schema: { tags: ['publications'], summary: 'Reenvia (FAILED/DEAD)', docs: { params: IdParams } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    await retryPublication(id, auth.user.id, request.ip);
    return getPublicationDTO(id);
  });

  app.post('/api/publications/:id/cancel', { schema: { tags: ['publications'], summary: 'Cancela uma publicação pendente', docs: { params: IdParams } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    await cancelPublication(id, auth.user.id, request.ip);
    return getPublicationDTO(id);
  });

  app.post('/api/publications/:id/mark-sent', { schema: { tags: ['publications'], summary: 'Marca como publicada manualmente (Modo B)', docs: { params: IdParams } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    await markManualSent(id, auth.user.id, request.ip); // o serviço já audita (uma única vez e só na transição real)
    return getPublicationDTO(id);
  });
}
