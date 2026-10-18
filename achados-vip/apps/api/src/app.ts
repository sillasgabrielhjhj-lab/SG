import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import Fastify, { type FastifyBaseLogger, type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Prisma } from '@prisma/client';
import { z, ZodError, type ZodType } from 'zod';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { AppError, ForbiddenError, TooManyRequestsError, UnauthorizedError, formatZodIssues } from './lib/errors.js';
import { readSessionToken, setSessionCookie } from './lib/session-cookie.js';
import { authenticateSession, isCsrfValid, type AuthContext, type AuthUser } from './services/auth.js';

export type { AuthContext };

export interface RateLimitSetting {
  max: number;
  timeWindow: string | number;
}

export interface BuildAppOptions {
  /** false => sem logs de requisição (padrão em testes). */
  logger?: boolean;
  rateLimit?: { global?: RateLimitSetting; login?: RateLimitSetting };
  /** Diretório de rotas (padrão: src/routes junto a este arquivo). */
  routesDir?: string;
}

export interface AppConfig {
  loginRateLimit: RateLimitSetting;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchido pelo hook de autenticação em rotas protegidas. */
    auth: AuthContext | null;
    /** Atalho para `auth.user`. */
    user: AuthUser | null;
  }
  interface FastifyInstance {
    appConfig: AppConfig;
  }
  interface FastifySchema {
    /** Schemas zod usados APENAS para gerar o OpenAPI (a validação é feita no handler com parseInput). */
    docs?: { body?: ZodType; querystring?: ZodType; params?: ZodType };
  }
}

const DEFAULT_GLOBAL_LIMIT: RateLimitSetting = { max: 600, timeWindow: '1 minute' };
const DEFAULT_LOGIN_LIMIT: RateLimitSetting = { max: 10, timeWindow: '1 minute' };

/** Rotas acessíveis sem sessão (decisão pelo padrão da ROTA registrada, não pela URL crua). */
function isPublicRoute(route: string): boolean {
  if (route === '/health' || route === '/ready' || route === '/api/auth/login') return true;
  // documentação: pública fora de produção; em produção exige sessão
  return !env.isProduction && (route === '/docs' || route.startsWith('/docs/'));
}

const isMutation = (method: string): boolean => !['GET', 'HEAD', 'OPTIONS'].includes(method);

export function toErrorResponse(err: unknown, requestId?: string): { status: number; body: { error: { code: string; message: string; details?: unknown } }; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  if (err instanceof AppError) {
    if (err instanceof TooManyRequestsError && err.retryAfterSeconds) headers['retry-after'] = String(err.retryAfterSeconds);
    return { status: err.status, body: err.toJSON(), headers };
  }
  if (err instanceof ZodError) {
    return { status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: formatZodIssues(err) } }, headers };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return { status: 409, body: { error: { code: 'CONFLICT', message: 'Já existe um registro com esses dados.' } }, headers };
    if (err.code === 'P2025') return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Registro não encontrado.' } }, headers };
    if (err.code === 'P2003') return { status: 409, body: { error: { code: 'CONFLICT', message: 'Referência inválida ou registro em uso.' } }, headers };
  }
  const e = err as { statusCode?: number; code?: string; validation?: unknown };
  if (typeof e?.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 500) {
    const map: Record<string, [number, string, string]> = {
      FST_ERR_CTP_BODY_TOO_LARGE: [413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição grande demais.'],
      FST_ERR_CTP_INVALID_MEDIA_TYPE: [415, 'UNSUPPORTED_MEDIA_TYPE', 'Tipo de conteúdo não suportado. Use application/json.'],
      FST_ERR_VALIDATION: [400, 'VALIDATION_ERROR', 'Dados inválidos.'],
    };
    const known = e.code ? map[e.code] : undefined;
    if (known) return { status: known[0], body: { error: { code: known[1], message: known[2], ...(e.validation ? { details: e.validation } : {}) } }, headers };
    return { status: e.statusCode, body: { error: { code: 'BAD_REQUEST', message: 'Requisição inválida.' } }, headers };
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente em instantes.', ...(requestId ? { details: { requestId } } : {}) } },
    headers,
  };
}

function toOpenApiSchema(schema: ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-7', io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

async function loadRoutes(app: FastifyInstance, routesDir: string): Promise<string[]> {
  const preferred = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
  const files = new Map<string, string>(); // base -> arquivo (evita carregar .ts e .js do mesmo módulo)
  for (const f of (await readdir(routesDir)).sort()) {
    if (f.startsWith('_') || f.endsWith('.d.ts') || !/\.[cm]?[tj]s$/.test(f) || /\.(test|spec)\.[cm]?[tj]s$/.test(f)) continue;
    const base = f.replace(/\.[cm]?[tj]s$/, '');
    if (!files.has(base) || f.endsWith(preferred)) files.set(base, f);
  }
  const loaded: string[] = [];
  for (const [base, file] of files) {
    const mod = (await import(pathToFileURL(path.join(routesDir, file)).href)) as { default?: unknown };
    if (typeof mod.default !== 'function') throw new Error(`Arquivo de rotas sem "export default async function (app)": ${file}`);
    await app.register(mod.default as (app: FastifyInstance) => Promise<void>);
    loaded.push(base);
  }
  return loaded;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const useLogger = opts.logger ?? !env.isTest;
  const globalLimit = opts.rateLimit?.global ?? DEFAULT_GLOBAL_LIMIT;
  const loginLimit = opts.rateLimit?.login ?? DEFAULT_LOGIN_LIMIT;

  const app = Fastify({
    ...(useLogger ? { loggerInstance: logger as FastifyBaseLogger } : { logger: false as const }),
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 2 * 1024 * 1024,
  });

  app.decorate('appConfig', { loginRateLimit: loginLimit } satisfies AppConfig);
  app.decorateRequest('auth', null);
  app.decorateRequest('user', null);

  // JSON: corpo vazio vira `undefined` (POST sem corpo, ex. logout) e erros usam o formato do contrato.
  const defaultJsonParser = app.getDefaultJsonParser('error', 'error');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body === '' || body === undefined) return done(null, undefined);
    defaultJsonParser(req, body as string, (err, parsed) =>
      err ? done(new AppError(400, 'INVALID_JSON', 'JSON inválido na requisição.'), undefined) : done(null, parsed),
    );
  });

  app.setErrorHandler((err, request, reply) => {
    const res = toErrorResponse(err, request.id);
    if (res.status >= 500) request.log.error({ err }, 'erro não tratado');
    for (const [k, v] of Object.entries(res.headers)) reply.header(k, v);
    return reply.code(res.status).send(res.body);
  });
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }),
  );

  // ---- plugins de segurança e documentação ----
  // CSP padrão do helmet; 'upgrade-insecure-requests' só em produção (em http://localhost quebraria a UI do /docs)
  await app.register(helmet, {
    contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': env.isProduction ? [] : null } },
  });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(rateLimit, {
    global: true,
    max: globalLimit.max,
    timeWindow: globalLimit.timeWindow,
    keyGenerator: (req: FastifyRequest) => req.ip,
    allowList: (req) => req.url === '/health' || req.url === '/ready',
    errorResponseBuilder: (_req, ctx) =>
      new TooManyRequestsError('Muitas requisições. Aguarde um instante e tente novamente.', 'RATE_LIMITED', Math.ceil(ctx.ttl / 1000)),
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Achados VIP Automation — API',
        version: '0.1.0',
        description: 'API administrativa. Autenticação por cookie de sessão (achados_sid) + header X-CSRF-Token nas mutações.',
      },
      components: {
        securitySchemes: {
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'achados_sid' },
          csrfToken: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
        },
      },
      security: [{ cookieAuth: [], csrfToken: [] }],
    },
    transform: ({ schema, url }) => {
      if (!schema?.docs) return { schema, url };
      const { docs, ...rest } = schema;
      const out: Record<string, unknown> = { ...rest };
      if (docs.body) out.body = toOpenApiSchema(docs.body);
      if (docs.querystring) out.querystring = toOpenApiSchema(docs.querystring);
      if (docs.params) out.params = toOpenApiSchema(docs.params);
      return { schema: out, url };
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // ---- autenticação + CSRF: NEGAR por padrão; só rotas públicas explícitas passam ----
  // preParsing (e não onRequest): o rate limit global roda em onRequest ANTES deste hook, e o corpo ainda não foi lido.
  app.addHook('preParsing', async (request, reply) => {
    const route = request.routeOptions?.url ?? '';
    if (isPublicRoute(route)) return;

    const token = readSessionToken(request);
    const session = token ? await authenticateSession(token) : null;
    if (!session || !token) throw new UnauthorizedError();
    request.auth = { user: session.user, sessionId: session.sessionId, csrfToken: session.csrfToken };
    request.user = session.user;
    if (session.renewed) setSessionCookie(reply, token); // renovação deslizante: reenvia o cookie

    if (isMutation(request.method)) {
      const origin = request.headers.origin;
      if (env.WEB_ORIGIN && origin && origin !== env.WEB_ORIGIN) throw new ForbiddenError('Origem não permitida.', 'CSRF_ORIGIN');
      if (!isCsrfValid(session.csrfToken, request.headers['x-csrf-token'])) {
        throw new ForbiddenError('Token CSRF ausente ou inválido.', 'CSRF_INVALID');
      }
      // perfil somente leitura só pode usar as rotas de conta (logout / troca de senha)
      if (session.user.role !== 'ADMIN' && !route.startsWith('/api/auth/')) {
        throw new ForbiddenError('Seu perfil não permite esta ação.', 'FORBIDDEN');
      }
    }
  });

  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/') || (request.routeOptions?.url ?? '').startsWith('/api/')) {
      reply.header('cache-control', 'no-store');
    }
  });

  // ---- rotas: todos os arquivos de src/routes (cada um: export default async function (app)) ----
  const routesDir = opts.routesDir ?? fileURLToPath(new URL('./routes/', import.meta.url));
  await loadRoutes(app, routesDir);

  return app;
}
