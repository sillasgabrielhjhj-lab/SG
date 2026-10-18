import type { FastifyInstance } from 'fastify';
import { getDashboard } from '../services/reporting.js';

export default async function (app: FastifyInstance) {
  app.get('/api/dashboard', { schema: { tags: ['dashboard'], summary: 'Painel: monitoramento, fonte, contadores do dia, série e jobs' } }, async () => getDashboard());
}
