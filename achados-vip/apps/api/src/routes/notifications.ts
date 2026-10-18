import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NotFoundError, parseInput } from '../lib/errors.js';
import { listNotifications, markAllRead, markRead } from '../services/notifications.js';

const ListQuery = z.object({
  unread: z.preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean()).default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
const IdParams = z.object({ id: z.string().min(1).max(64) });

export default async function (app: FastifyInstance) {
  app.get('/api/notifications', { schema: { tags: ['notifications'], summary: 'Alertas do painel (mais recentes primeiro)', docs: { querystring: ListQuery } } }, async (request) => {
    const q = parseInput(ListQuery, request.query);
    return listNotifications({ unreadOnly: q.unread, limit: q.limit });
  });

  app.post('/api/notifications/read-all', { schema: { tags: ['notifications'], summary: 'Marca todos como lidos' } }, async () => {
    const count = await markAllRead();
    return { ok: true, count };
  });

  app.post('/api/notifications/:id/read', { schema: { tags: ['notifications'], summary: 'Marca um alerta como lido' } }, async (request) => {
    const { id } = parseInput(IdParams, request.params);
    if (!(await markRead(id))) throw new NotFoundError('Notificação não encontrada.');
    return { ok: true };
  });
}
