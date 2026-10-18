import { hash, verify } from '@node-rs/argon2';
import type { UserRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { randomToken, sha256, timingSafeEqual } from '../lib/crypto.js';
import { AppError, TooManyRequestsError, UnauthorizedError, ValidationError } from '../lib/errors.js';
import { DAY_MS, MINUTE_MS } from '../lib/time.js';
import { SESSION_TTL_MS } from '../lib/session-cookie.js';
import { recordAudit, recordAuditSafe } from './audit.js';
import { logEvent } from './logs.js';

export { SESSION_TTL_MS };
/** Teto absoluto: mesmo com renovação deslizante, a sessão morre 7 dias após o login. */
export const SESSION_ABSOLUTE_MAX_MS = 7 * DAY_MS;
export const MAX_SESSIONS_PER_USER = 5;
/** A sessão só é regravada (renovação) se a última gravação foi há mais que isto. */
const RENEW_AFTER_MS = MINUTE_MS;
/** Número de falhas consecutivas que dispara o 1º bloqueio. */
export const LOCK_THRESHOLD = 5;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/** Contexto de autenticação anexado a `request.auth` pelo hook global (app.ts). */
export interface AuthContext {
  user: AuthUser;
  sessionId: string;
  csrfToken: string;
}

/** Em handlers de rotas protegidas: devolve o contexto ou lança 401 (defesa em profundidade). */
export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new UnauthorizedError();
  return request.auth;
}

export interface LoginResult {
  user: AuthUser;
  /** Token cru do cookie (só existe aqui; no banco fica apenas o sha256). */
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
}

export interface AuthenticatedSession {
  user: AuthUser;
  sessionId: string;
  csrfToken: string;
  expiresAt: Date;
  /** true se a validade deslizante foi estendida nesta chamada (o cookie deve ser reenviado). */
  renewed: boolean;
}

export interface RequestMeta {
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
}

// ---- Senhas -----------------------------------------------------------------------

// Argon2id (padrão do @node-rs/argon2) com parâmetros OWASP: 19 MiB, 2 passes, 1 thread.
const ARGON_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string): Promise<string> => hash(password, ARGON_OPTIONS);

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Mensagem de erro (pt-BR) se a senha não atende à política; null se ok. */
export function validatePasswordPolicy(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  if (password.trim().length < PASSWORD_MIN_LENGTH) return 'A senha não pode ser composta apenas de espaços.';
  if (email && password.toLowerCase() === email.toLowerCase()) return 'A senha não pode ser igual ao e-mail.';
  if (new Set(password).size < 4) return 'A senha é simples demais.';
  return null;
}

let dummyHashPromise: Promise<string> | null = null;
/** Hash descartável: gasta o mesmo tempo quando o e-mail não existe (evita enumeração por tempo). */
const dummyHash = (): Promise<string> => (dummyHashPromise ??= hashPassword('senha-descartavel-para-igualar-tempo'));

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const EmailSchema = z.string().max(254).pipe(z.email());

// ---- Bloqueio progressivo ---------------------------------------------------------

/** 5 falhas => 1 min; depois dobra a cada nova falha (2, 4, 8, 16 min) até o teto de 30 min. */
export function lockDurationMs(failures: number): number {
  if (failures < LOCK_THRESHOLD) return 0;
  return Math.min(MINUTE_MS * 2 ** (failures - LOCK_THRESHOLD), 30 * MINUTE_MS);
}

async function registerFailure(userId: string, now: Date): Promise<number> {
  const { failedLogins } = await prisma.user.update({
    where: { id: userId },
    data: { failedLogins: { increment: 1 } },
    select: { failedLogins: true },
  });
  const lockMs = lockDurationMs(failedLogins);
  if (lockMs > 0) await prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(now.getTime() + lockMs) } });
  return failedLogins;
}

const lockedError = (until: Date, now: Date): TooManyRequestsError =>
  new TooManyRequestsError(
    'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.',
    'LOGIN_LOCKED',
    Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000)),
  );

const invalidCredentials = (): UnauthorizedError => new UnauthorizedError('Credenciais inválidas.', 'INVALID_CREDENTIALS');

// ---- Login / sessão ---------------------------------------------------------------

export async function login(input: { email: string; password: string; now?: Date } & RequestMeta): Promise<LoginResult> {
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await verifyPassword(await dummyHash(), input.password); // iguala o tempo de resposta
    await recordAuditSafe({ action: 'auth.login_failed', entity: 'User', after: { reason: 'unknown_user' }, ip: input.ip ?? null });
    throw invalidCredentials();
  }
  if (user.lockedUntil && user.lockedUntil > now) {
    await recordAuditSafe({ userId: user.id, action: 'auth.login_blocked', entity: 'User', entityId: user.id, ip: input.ip ?? null });
    throw lockedError(user.lockedUntil, now);
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failures = await registerFailure(user.id, now);
    await recordAuditSafe({
      userId: user.id,
      action: 'auth.login_failed',
      entity: 'User',
      entityId: user.id,
      after: { reason: 'bad_password', failedLogins: failures },
      ip: input.ip ?? null,
    });
    if (failures >= LOCK_THRESHOLD) {
      await logEvent('WARN', 'auth', 'conta bloqueada temporariamente após falhas de login', { userId: user.id, failures });
    }
    throw invalidCredentials();
  }

  const sessionToken = randomToken(32);
  const csrfToken = randomToken(24);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    // limpa expiradas e mantém no máximo MAX_SESSIONS_PER_USER (descarta as mais antigas)
    await tx.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: now } } });
    const active = await tx.session.findMany({ where: { userId: user.id }, orderBy: { lastUsedAt: 'asc' }, select: { id: true } });
    const excess = active.length - (MAX_SESSIONS_PER_USER - 1);
    if (excess > 0) await tx.session.deleteMany({ where: { id: { in: active.slice(0, excess).map((s) => s.id) } } });
    await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(sessionToken),
        csrfToken,
        expiresAt,
        createdAt: now,
        lastUsedAt: now,
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    });
  });
  await recordAuditSafe({ userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id, ip: input.ip ?? null });
  return { user: { id: user.id, email: user.email, role: user.role }, sessionToken, csrfToken, expiresAt };
}

/** Valida o token do cookie. Estende a validade deslizante (no máx. 1 gravação/min). Null se inválido/expirado. */
export async function authenticateSession(token: string, now: Date = new Date()): Promise<AuthenticatedSession | null> {
  if (!token || token.length > 128) return null;
  const row = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  if (!row) return null;
  const absoluteLimit = new Date(row.createdAt.getTime() + SESSION_ABSOLUTE_MAX_MS);
  if (row.expiresAt <= now || absoluteLimit <= now) {
    await prisma.session.deleteMany({ where: { id: row.id } });
    return null;
  }
  let expiresAt = row.expiresAt;
  let renewed = false;
  if (now.getTime() - row.lastUsedAt.getTime() >= RENEW_AFTER_MS) {
    const slid = new Date(Math.min(now.getTime() + SESSION_TTL_MS, absoluteLimit.getTime()));
    await prisma.session.update({ where: { id: row.id }, data: { lastUsedAt: now, expiresAt: slid } });
    expiresAt = slid;
    renewed = true;
  }
  return { user: row.user, sessionId: row.id, csrfToken: row.csrfToken, expiresAt, renewed };
}

export const isCsrfValid = (expected: string, provided: unknown): boolean =>
  typeof provided === 'string' && provided.length > 0 && timingSafeEqual(expected, provided);

export async function logout(sessionId: string, userId: string, ip?: string | null): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
  await recordAuditSafe({ userId, action: 'auth.logout', entity: 'User', entityId: userId, ip: ip ?? null });
}

/** Troca de senha: exige a atual, invalida TODAS as outras sessões e audita. Devolve quantas sessões foram revogadas. */
export async function changePassword(input: {
  userId: string;
  currentSessionId: string;
  currentPassword: string;
  newPassword: string;
  ip?: string | null;
  now?: Date;
}): Promise<{ revokedSessions: number }> {
  const now = input.now ?? new Date();
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new UnauthorizedError();
  if (user.lockedUntil && user.lockedUntil > now) throw lockedError(user.lockedUntil, now);

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    await registerFailure(user.id, now); // tentativas com sessão roubada também contam para o bloqueio
    await recordAuditSafe({ userId: user.id, action: 'auth.change_password_failed', entity: 'User', entityId: user.id, ip: input.ip ?? null });
    // 400 (e não 401): o front interpretaria 401 como sessão expirada
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Senha atual incorreta.');
  }
  const policy = validatePasswordPolicy(input.newPassword, user.email);
  if (policy) throw new ValidationError(policy);
  if (input.newPassword === input.currentPassword) throw new ValidationError('A nova senha deve ser diferente da atual.');

  const passwordHash = await hashPassword(input.newPassword);
  const revoked = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, failedLogins: 0, lockedUntil: null } });
    const { count } = await tx.session.deleteMany({ where: { userId: user.id, id: { not: input.currentSessionId } } });
    await recordAudit({ userId: user.id, action: 'auth.change_password', entity: 'User', entityId: user.id, after: { revokedSessions: count }, ip: input.ip ?? null }, tx);
    return count;
  });
  return { revokedSessions: revoked };
}

/** Cria ou atualiza o administrador (CLI). Atualizar a senha revoga todas as sessões do usuário. */
export async function createOrUpdateAdmin(emailInput: string, password: string): Promise<{ created: boolean; user: AuthUser }> {
  const parsed = EmailSchema.safeParse(normalizeEmail(emailInput));
  if (!parsed.success) throw new ValidationError('E-mail inválido.');
  const email = parsed.data;
  const policy = validatePasswordPolicy(password, email);
  if (policy) throw new ValidationError(policy);

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const user = await prisma.user.create({ data: { email, passwordHash, role: 'ADMIN' } });
    await recordAuditSafe({ userId: null, action: 'user.create', entity: 'User', entityId: user.id, after: { email, role: 'ADMIN' } });
    return { created: true, user: { id: user.id, email: user.email, role: user.role } };
  }
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: existing.id }, data: { passwordHash, role: 'ADMIN', failedLogins: 0, lockedUntil: null } });
    await tx.session.deleteMany({ where: { userId: existing.id } });
    return u;
  });
  await recordAuditSafe({ userId: null, action: 'user.password_reset', entity: 'User', entityId: user.id, after: { email } });
  return { created: false, user: { id: user.id, email: user.email, role: user.role } };
}

/** Remove sessões expiradas (manutenção). */
export async function purgeExpiredSessions(now: Date = new Date()): Promise<number> {
  return (await prisma.session.deleteMany({ where: { expiresAt: { lte: now } } })).count;
}
