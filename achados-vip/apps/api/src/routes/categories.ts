import type { FastifyInstance } from 'fastify';
import type { Category } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { AppError, NotFoundError, parseInput } from '../lib/errors.js';
import { requireAuth } from '../services/auth.js';
import { recordAudit } from '../services/audit.js';

export interface CategoryDTO {
  id: string;
  key: string;
  name: string;
  mlCategoryIds: string[];
  searchTerms: string[];
  enabled: boolean;
  relevance: number;
  dailyLimit: number | null;
  minScore: number | null;
  sortOrder: number;
}

const toDTO = (c: Category): CategoryDTO => ({
  id: c.id,
  key: c.key,
  name: c.name,
  mlCategoryIds: c.mlCategoryIds,
  searchTerms: c.searchTerms,
  enabled: c.enabled,
  relevance: c.relevance,
  dailyLimit: c.dailyLimit,
  minScore: c.minScore,
  sortOrder: c.sortOrder,
});

const unique = (xs: string[]): string[] => [...new Set(xs)];

const CategoryPatch = z
  .strictObject({
    enabled: z.boolean(),
    relevance: z.number().int().min(0).max(100),
    dailyLimit: z.number().int().min(1).max(10_000).nullable(),
    minScore: z.number().int().min(0).max(100).nullable(),
    mlCategoryIds: z.array(z.string().trim().toUpperCase().regex(/^MLB\d+$/, 'ID de categoria inválido (ex.: MLB1055)')).max(50),
    searchTerms: z.array(z.string().trim().min(2).max(100)).max(50),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'informe ao menos um campo para alterar' });

const IdParams = z.object({ id: z.string().min(1).max(64) });

export default async function (app: FastifyInstance) {
  app.get('/api/categories', { schema: { tags: ['categories'], summary: 'Categorias monitoradas' } }, async () => {
    const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return rows.map(toDTO);
  });

  app.patch(
    '/api/categories/:id',
    { schema: { tags: ['categories'], summary: 'Atualiza uma categoria', docs: { body: CategoryPatch } } },
    async (request) => {
      const auth = requireAuth(request);
      const { id } = parseInput(IdParams, request.params);
      const patch = parseInput(CategoryPatch, request.body);
      const before = await prisma.category.findUnique({ where: { id } });
      if (!before) throw new NotFoundError('Categoria não encontrada.');

      const data = {
        ...patch,
        ...(patch.mlCategoryIds ? { mlCategoryIds: unique(patch.mlCategoryIds) } : {}),
        ...(patch.searchTerms ? { searchTerms: unique(patch.searchTerms) } : {}),
      };
      const finalEnabled = data.enabled ?? before.enabled;
      const finalIds = data.mlCategoryIds ?? before.mlCategoryIds;
      const finalTerms = data.searchTerms ?? before.searchTerms;
      if (finalEnabled && finalIds.length === 0 && finalTerms.length === 0) {
        throw new AppError(422, 'CATEGORY_WITHOUT_SOURCE', 'Para habilitar a categoria, informe ao menos um ID de categoria do Mercado Livre ou um termo de busca.');
      }

      const after = await prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({ where: { id }, data });
        await recordAudit(
          { userId: auth.user.id, action: 'category.update', entity: 'Category', entityId: id, before: toDTO(before), after: toDTO(updated), ip: request.ip },
          tx,
        );
        return updated;
      });
      return toDTO(after);
    },
  );
}
