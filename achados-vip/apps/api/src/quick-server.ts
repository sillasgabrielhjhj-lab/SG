/**
 * Mini servidor do "Gerar post": SEM banco de dados e SEM Redis. Uma senha (QUICK_PASSWORD) protege tudo.
 * Cole o link de afiliado -> texto para WhatsApp + imagem. Reaproveita a mesma lógica do painel (services/quick-*).
 *
 * Variáveis: QUICK_PASSWORD (>= 10 caracteres), QUICK_SECRET (>= 32, assina o cookie), PORT, HOST, COOKIE_SECURE.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { defaultSettings } from './domain/settings.js';
import { AppError } from './lib/errors.js';
import { buildPreview, fetchProductImage } from './services/quick-fetch.js';
import { QUICK_CSS, QUICK_HTML, QUICK_JS } from './quick-page.js';

const COOKIE = 'quick_sid';
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const WINDOW_MS = 10 * 60 * 1000;

export interface QuickServerOptions {
  password: string;
  secret: string;
  cookieSecure?: boolean;
  trustProxy?: boolean;
  now?: () => number;
  logger?: boolean;
}

const eq = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function buildQuickServer(opts: QuickServerOptions): FastifyInstance {
  if (opts.password.length < 10) throw new Error('QUICK_PASSWORD deve ter ao menos 10 caracteres');
  if (opts.secret.length < 32) throw new Error('QUICK_SECRET deve ter ao menos 32 caracteres');
  const now = opts.now ?? Date.now;
  const settings = defaultSettings();
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: opts.trustProxy ?? false, bodyLimit: 20_000 });
  const fails = new Map<string, { n: number; first: number }>();

  const sign = (exp: number, nonce: string) => createHmac('sha256', opts.secret).update(`${exp}.${nonce}`).digest('base64url');
  const issue = () => {
    const exp = now() + SESSION_MS;
    const nonce = randomBytes(12).toString('base64url');
    return `${exp}.${nonce}.${sign(exp, nonce)}`;
  };
  const valid = (token: string | undefined): boolean => {
    const [exp, nonce, sig] = (token ?? '').split('.');
    if (!exp || !nonce || !sig || !/^\d+$/.test(exp) || Number(exp) < now()) return false;
    return eq(sig, sign(Number(exp), nonce));
  };
  const cookies = (req: FastifyRequest): Record<string, string> =>
    Object.fromEntries(String(req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  const authed = (req: FastifyRequest) => valid(cookies(req)[COOKIE]);
  const setCookie = (reply: FastifyReply, value: string, maxAgeS: number) =>
    reply.header('set-cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeS}${opts.cookieSecure ? '; Secure' : ''}`);

  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff').header('referrer-policy', 'no-referrer').header('x-frame-options', 'DENY');
    reply.header('content-security-policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
  });
  // proteção CSRF: toda mutação exige o cabeçalho customizado (formulários de outros sites não conseguem enviá-lo)
  app.addHook('preHandler', async (req) => {
    if (req.method === 'POST' && req.headers['x-requested-with'] !== 'fetch') throw new AppError(403, 'CSRF', 'Requisição recusada.');
  });
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.status(status).send({ error: { code: 'BAD_REQUEST', message: 'Requisição inválida.' } });
    app.log.error({ err: { message: err instanceof Error ? err.message : String(err) } }, 'erro');
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Erro interno.' } });
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/', async (_r, reply) => reply.type('text/html; charset=utf-8').send(QUICK_HTML));
  app.get('/app.js', async (_r, reply) => reply.type('text/javascript; charset=utf-8').send(QUICK_JS));
  app.get('/app.css', async (_r, reply) => reply.type('text/css; charset=utf-8').send(QUICK_CSS));
  app.get('/me', async (req, reply) => (authed(req) ? { ok: true } : reply.status(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Entre com a senha.' } })));

  app.post('/login', async (req, reply) => {
    const ip = req.ip;
    const f = fails.get(ip);
    if (f && now() - f.first < WINDOW_MS && f.n >= MAX_FAILS) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas. Aguarde alguns minutos.');
    const body = z.object({ password: z.string().max(200) }).safeParse(req.body);
    if (!body.success || !eq(body.data.password, opts.password)) {
      fails.set(ip, f && now() - f.first < WINDOW_MS ? { n: f.n + 1, first: f.first } : { n: 1, first: now() });
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Senha incorreta.');
    }
    fails.delete(ip);
    setCookie(reply, issue(), SESSION_MS / 1000);
    return { ok: true };
  });
  app.post('/logout', async (_req, reply) => {
    setCookie(reply, '', 0);
    return { ok: true };
  });

  const PreviewBody = z.strictObject({
    url: z.string().trim().min(8).max(2048),
    title: z.string().trim().max(300).optional(),
    price: z.union([z.string(), z.number()]).optional(),
    originalPrice: z.union([z.string(), z.number()]).optional(),
    couponCode: z.string().trim().max(60).optional(),
    imageUrl: z.string().trim().max(2048).optional(),
  });
  app.post('/preview', async (req, reply) => {
    if (!authed(req)) return reply.status(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Entre com a senha.' } });
    const parsed = PreviewBody.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'VALIDATION', 'Dados inválidos: confira o link e os valores.');
    return buildPreview(parsed.data, settings);
  });
  app.get('/image', async (req, reply) => {
    if (!authed(req)) return reply.status(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Entre com a senha.' } });
    const q = z.object({ url: z.string().max(2048), download: z.string().optional() }).safeParse(req.query);
    if (!q.success) throw new AppError(400, 'VALIDATION', 'Imagem inválida.');
    const img = await fetchProductImage(q.data.url);
    reply.header('content-type', img.type).header('cache-control', 'private, max-age=3600');
    if (q.data.download) reply.header('content-disposition', `attachment; filename="produto.${img.ext}"`);
    return reply.send(img.body);
  });
  return app;
}

// ---- execução (somente quando chamado diretamente) ----
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const password = process.env.QUICK_PASSWORD ?? '';
  const secret = process.env.QUICK_SECRET ?? '';
  const app = buildQuickServer({
    password,
    secret,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    trustProxy: process.env.TRUST_PROXY === 'true',
    logger: true,
  });
  const close = () => void app.close().then(() => process.exit(0));
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
  await app.listen({ port: Number(process.env.PORT ?? 3002), host: process.env.HOST ?? '127.0.0.1' });
}
