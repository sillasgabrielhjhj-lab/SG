import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseInput } from '../lib/errors.js';
import { getReportSummary } from '../services/reporting.js';

const SummaryQuery = z.object({ days: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.coerce.number().int().min(1).max(365).default(30)) });

export default async function (app: FastifyInstance) {
  app.get('/api/reports/summary', { schema: { tags: ['reports'], summary: 'Resumo do período (consultas reais; affiliateMetrics indisponível)', docs: { querystring: SummaryQuery } } }, async (request) => {
    const { days } = parseInput(SummaryQuery, request.query);
    return getReportSummary(days);
  });
}
