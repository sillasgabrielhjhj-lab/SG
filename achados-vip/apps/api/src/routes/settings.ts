import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SettingsSchema, type Settings } from '../domain/settings.js';
import { parseInput } from '../lib/errors.js';
import { requireAuth } from '../services/auth.js';
import { notifySettingsChanged } from '../queues/scheduler.js';
import { getSettings, updateSettings, type DeepPartial } from '../services/settings.js';

const PatchBody = z.record(z.string(), z.unknown());

export default async function (app: FastifyInstance) {
  app.get('/api/settings', { schema: { tags: ['settings'], summary: 'Configurações de automação' } }, async () => getSettings());

  app.put(
    '/api/settings',
    {
      schema: {
        tags: ['settings'],
        summary: 'Atualiza configurações',
        description: 'Patch parcial e profundo: envie só o que muda. Campos desconhecidos são recusados. A alteração é auditada (before/after).',
        docs: { body: SettingsSchema },
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const patch = parseInput(PatchBody, request.body, 'O corpo deve ser um objeto com as configurações a alterar.');
      const updated = await updateSettings(patch as DeepPartial<Settings>, auth.user.id, request.ip);
      notifySettingsChanged(); // reaplica agendadores (intervalo/monitoramento) sem bloquear a resposta
      return updated;
    },
  );
}
