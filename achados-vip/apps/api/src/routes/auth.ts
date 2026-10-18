import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseInput } from '../lib/errors.js';
import { clearSessionCookie, setSessionCookie } from '../lib/session-cookie.js';
import { changePassword, login, logout, requireAuth } from '../services/auth.js';

const LoginBody = z.strictObject({
  email: z.string().min(3).max(254),
  password: z.string().min(1).max(256),
});
const ChangePasswordBody = z.strictObject({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});

export default async function (app: FastifyInstance) {
  // rate limit ESTRITO por IP somente no login (além do bloqueio progressivo por conta)
  app.post(
    '/api/auth/login',
    { config: { rateLimit: app.appConfig.loginRateLimit }, schema: { tags: ['auth'], summary: 'Login (define o cookie de sessão)', docs: { body: LoginBody } } },
    async (request, reply) => {
      const body = parseInput(LoginBody, request.body);
      const result = await login({ ...body, ip: request.ip, userAgent: request.headers['user-agent'] });
      setSessionCookie(reply, result.sessionToken);
      return { user: result.user, csrfToken: result.csrfToken };
    },
  );

  app.post('/api/auth/logout', { schema: { tags: ['auth'], summary: 'Encerra a sessão atual' } }, async (request, reply) => {
    const auth = requireAuth(request);
    await logout(auth.sessionId, auth.user.id, request.ip);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/api/auth/me', { schema: { tags: ['auth'], summary: 'Usuário da sessão e token CSRF' } }, async (request) => {
    const auth = requireAuth(request);
    return { user: auth.user, csrfToken: auth.csrfToken };
  });

  app.post(
    '/api/auth/change-password',
    { schema: { tags: ['auth'], summary: 'Troca a senha e invalida as outras sessões', docs: { body: ChangePasswordBody } } },
    async (request) => {
      const auth = requireAuth(request);
      const body = parseInput(ChangePasswordBody, request.body);
      await changePassword({ userId: auth.user.id, currentSessionId: auth.sessionId, ...body, ip: request.ip });
      return { ok: true };
    },
  );
}
