import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { parseInput } from '../lib/errors.js';
import { PageQuerySchema } from '../lib/pagination.js';
import { addLink, countLinksByStatus, deleteLink, getLinkDTO, importBatch, listLinks, listPendingProducts, pendingToCsv, validateLink } from '../services/affiliate.js';
import { recordAudit } from '../services/audit.js';
import { requireAuth } from '../services/auth.js';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const IdParams = z.object({ id: z.string().min(1).max(64) });
const LinksQuery = PageQuerySchema.extend({
  status: z.preprocess((v) => {
    const s = emptyToUndefined(v); // "?status=" (vazio) = sem filtro
    return typeof s === 'string' ? s.toUpperCase() : s;
  }, z.enum(['PENDING', 'VALIDATED', 'INVALID']).optional()),
  productId: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
});
const AddBody = z.strictObject({ productId: z.string().min(1).max(64), url: z.string().trim().min(1).max(4096) });
const ImportBody = z.strictObject({ text: z.string().min(1).max(1_000_000) });

export const GENERATION_UNAVAILABLE_REASON =
  'Não existe API oficial para gerar links de afiliado do Mercado Livre. Gere os links no portal de afiliados e importe-os aqui; o sistema nunca cria nem altera URLs de afiliado.';

export default async function (app: FastifyInstance) {
  app.get('/api/affiliate/status', { schema: { tags: ['affiliate'], summary: 'Situação dos links de afiliado' } }, async () => ({
    generation: { available: false, reason: GENERATION_UNAVAILABLE_REASON },
    credentialsConfigured: (await prisma.integrationCredential.count({ where: { provider: 'affiliate' } })) > 0,
    counts: await countLinksByStatus(),
  }));

  app.get('/api/affiliate/links', { schema: { tags: ['affiliate'], summary: 'Links de afiliado (paginado)', docs: { querystring: LinksQuery } } }, async (request) => {
    const q = parseInput(LinksQuery, request.query);
    return listLinks({ page: q.page, pageSize: q.pageSize, ...(q.status ? { status: q.status } : {}), ...(q.productId ? { productId: q.productId } : {}) });
  });

  app.post('/api/affiliate/links', { schema: { tags: ['affiliate'], summary: 'Cadastra e valida um link de afiliado', docs: { body: AddBody } } }, async (request) => {
    const auth = requireAuth(request);
    const body = parseInput(AddBody, request.body);
    const link = await addLink(body.productId, body.url, auth.user.id);
    await recordAudit({ userId: auth.user.id, action: 'affiliate.link.add', entity: 'AffiliateLink', entityId: link.id, after: { productId: link.productId, status: link.status }, ip: request.ip });
    return getLinkDTO(link.id);
  });

  app.post(
    '/api/affiliate/links/import',
    {
      schema: {
        tags: ['affiliate'],
        summary: 'Importa links em lote',
        description: 'Linhas `URL_ML ; URL_AFILIADO` ou `MLB123 ; URL_AFILIADO` (também CSV com `,`/`;`/TAB). Cabeçalho e linhas vazias são ignorados.',
        docs: { body: ImportBody },
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const body = parseInput(ImportBody, request.body);
      const result = await importBatch(body.text, auth.user.id);
      await recordAudit({
        userId: auth.user.id,
        action: 'affiliate.import',
        entity: 'AffiliateLink',
        after: { imported: result.imported, validated: result.validated, invalid: result.invalid.length, unmatched: result.unmatched.length },
        ip: request.ip,
      });
      return result;
    },
  );

  app.post('/api/affiliate/links/:id/validate', { schema: { tags: ['affiliate'], summary: 'Valida (ou revalida) um link', docs: { params: IdParams } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    const link = await validateLink(id);
    await recordAudit({ userId: auth.user.id, action: 'affiliate.link.validate', entity: 'AffiliateLink', entityId: id, after: { status: link.status }, ip: request.ip });
    return getLinkDTO(id);
  });

  app.delete('/api/affiliate/links/:id', { schema: { tags: ['affiliate'], summary: 'Exclui um link (não usado em publicações)', docs: { params: IdParams } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    await deleteLink(id);
    await recordAudit({ userId: auth.user.id, action: 'affiliate.link.delete', entity: 'AffiliateLink', entityId: id, ip: request.ip });
    return { ok: true };
  });

  app.get('/api/affiliate/pending', { schema: { tags: ['affiliate'], summary: 'Produtos qualificados/aprovados sem link validado' } }, async () => listPendingProducts());

  app.get('/api/affiliate/pending.csv', { schema: { tags: ['affiliate'], summary: 'Pendentes em CSV (id;titulo;url_ml;score)' } }, async (_request, reply) => {
    const csv = pendingToCsv(await listPendingProducts());
    return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="links-pendentes.csv"').send(csv);
  });
}
