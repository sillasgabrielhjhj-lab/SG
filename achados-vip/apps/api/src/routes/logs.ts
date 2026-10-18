import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseInput } from '../lib/errors.js';
import { PageQuerySchema } from '../lib/pagination.js';
import { listAudit } from '../services/audit.js';
import { listLogs } from '../services/logs.js';

const LogsQuery = PageQuerySchema.extend({
  level: z.preprocess((v) => (typeof v === 'string' ? v.toUpperCase() : v), z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR'])).optional(),
  scope: z.string().min(1).max(100).optional(),
});

export default async function (app: FastifyInstance) {
  app.get('/api/logs', { schema: { tags: ['logs'], summary: 'Logs do sistema (paginado)', docs: { querystring: LogsQuery } } }, async (request) => {
    const q = parseInput(LogsQuery, request.query);
    return listLogs({ page: q.page, pageSize: q.pageSize, ...(q.level ? { level: q.level } : {}), ...(q.scope ? { scope: q.scope } : {}) });
  });

  app.get('/api/audit', { schema: { tags: ['logs'], summary: 'Trilha de auditoria (paginado)', docs: { querystring: PageQuerySchema } } }, async (request) => {
    return listAudit(parseInput(PageQuerySchema, request.query));
  });
}
