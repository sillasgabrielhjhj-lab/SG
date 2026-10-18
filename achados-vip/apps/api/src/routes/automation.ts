import type { FastifyInstance } from 'fastify';
import { recordAudit } from '../services/audit.js';
import { requireAuth } from '../services/auth.js';
import { enqueueManualJob } from '../queues/queues.js';
import { syncSchedules } from '../queues/scheduler.js';

export default async function (app: FastifyInstance) {
  app.post('/api/automation/run-discovery', { schema: { tags: ['automation'], summary: 'Enfileira uma busca de ofertas agora' } }, async (request) => {
    const auth = requireAuth(request);
    const r = await enqueueManualJob('discovery', auth.user.id);
    await recordAudit({ userId: auth.user.id, action: 'automation.run-discovery', entity: 'ScheduledJob', ip: request.ip });
    return { queued: true, ...r };
  });

  app.post('/api/automation/run-publisher', { schema: { tags: ['automation'], summary: 'Enfileira o processamento de publicações agora' } }, async (request) => {
    const auth = requireAuth(request);
    const r = await enqueueManualJob('publish-tick', auth.user.id);
    await recordAudit({ userId: auth.user.id, action: 'automation.run-publisher', entity: 'ScheduledJob', ip: request.ip });
    return { queued: true, ...r };
  });

  app.post('/api/automation/apply', { schema: { tags: ['automation'], summary: 'Reaplica os agendamentos conforme as configurações' } }, async (request) => {
    requireAuth(request);
    return syncSchedules();
  });
}
