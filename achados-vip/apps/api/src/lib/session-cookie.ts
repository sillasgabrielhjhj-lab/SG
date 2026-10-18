import type { FastifyReply, FastifyRequest } from 'fastify';
import '@fastify/cookie'; // tipos: setCookie/clearCookie/unsignCookie
import { env } from './env.js';
import { HOUR_MS } from './time.js';

/** Cookie de sessão: HttpOnly + SameSite=Strict (+ Secure em produção), assinado com SESSION_SECRET. */
export const SESSION_COOKIE = 'achados_sid';
/** Validade deslizante da sessão: 12h. */
export const SESSION_TTL_MS = 12 * HOUR_MS;

export function sessionCookieOptions(secure: boolean = env.COOKIE_SECURE) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure,
    signed: true,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(reply: FastifyReply): void {
  const { maxAge: _maxAge, signed: _signed, ...opts } = sessionCookieOptions();
  reply.clearCookie(SESSION_COOKIE, opts);
}

/** Lê e valida a assinatura do cookie; devolve o token cru da sessão ou null. */
export function readSessionToken(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const res = request.unsignCookie(raw);
  return res.valid && res.value ? res.value : null;
}
