import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseInput } from '../lib/errors.js';
import { requireAuth } from '../services/auth.js';
import {
  createChannel,
  deleteChannel,
  deleteCredential,
  getIntegrationsOverview,
  saveCredential,
  testChannel,
  testSource,
  updateChannel,
} from '../services/channels.js';

const IdParams = z.object({ id: z.string().min(1).max(64) });
const CredentialBody = z.strictObject({
  provider: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  values: z.record(z.string(), z.unknown()),
});
const ChannelType = z.enum(['WHATSAPP_CLOUD_GROUP', 'WHATSAPP_MANUAL_QUEUE', 'TELEGRAM', 'WEBHOOK']);
const CreateChannelBody = z.strictObject({
  type: ChannelType,
  name: z.string().trim().min(1).max(80),
  config: z.record(z.string(), z.unknown()).default({}),
  credentialId: z.string().max(64).nullish(),
  enabled: z.boolean().optional(),
});
const UpdateChannelBody = z
  .strictObject({
    name: z.string().trim().min(1).max(80),
    config: z.record(z.string(), z.unknown()),
    credentialId: z.string().max(64).nullable(),
    enabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'informe ao menos um campo para alterar' });

/** Remove chaves `undefined` (exactOptionalPropertyTypes-friendly). */
const defined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export default async function (app: FastifyInstance) {
  app.get('/api/integrations', { schema: { tags: ['integrations'], summary: 'Fonte, canais, credenciais (somente hint) e modos A/B/C com status real' } }, async () => getIntegrationsOverview());

  app.post('/api/integrations/credentials', { schema: { tags: ['integrations'], summary: 'Salva credencial (write-only, criptografada)', docs: { body: CredentialBody } } }, async (request) => {
    const auth = requireAuth(request);
    const body = parseInput(CredentialBody, request.body);
    return saveCredential(body, auth.user.id, request.ip);
  });

  app.delete('/api/integrations/credentials/:id', { schema: { tags: ['integrations'], summary: 'Remove credencial sem canais vinculados', docs: { params: IdParams } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    await deleteCredential(id, auth.user.id, request.ip);
    return { ok: true };
  });

  app.post('/api/integrations/channels', { schema: { tags: ['integrations'], summary: 'Cria canal de publicação', docs: { body: CreateChannelBody } } }, async (request) => {
    const auth = requireAuth(request);
    const body = parseInput(CreateChannelBody, request.body);
    return createChannel(defined(body), auth.user.id, request.ip);
  });

  app.patch('/api/integrations/channels/:id', { schema: { tags: ['integrations'], summary: 'Atualiza canal', docs: { params: IdParams, body: UpdateChannelBody } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    const body = parseInput(UpdateChannelBody, request.body);
    return updateChannel(id, defined(body), auth.user.id, request.ip);
  });

  app.delete('/api/integrations/channels/:id', { schema: { tags: ['integrations'], summary: 'Remove canal sem histórico de envio', docs: { params: IdParams } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    await deleteChannel(id, auth.user.id, request.ip);
    return { ok: true };
  });

  app.post('/api/integrations/channels/:id/test', { schema: { tags: ['integrations'], summary: 'Teste de conexão real do canal', docs: { params: IdParams } } }, async (request) => {
    requireAuth(request);
    const { id } = parseInput(IdParams, request.params);
    return testChannel(id);
  });

  app.post('/api/integrations/source/test', { schema: { tags: ['integrations'], summary: 'Teste de conexão da fonte de ofertas (Mercado Livre)' } }, async (request) => {
    requireAuth(request);
    return testSource();
  });
}
