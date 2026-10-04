import "server-only";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { AppError, conflict } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { audit } from "@/server/observability/audit";
import { getDummyHash, hashPassword, verifyPassword } from "@/server/auth/password";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { destroyAllSessions } from "@/server/auth/session";
import { getEmailProvider } from "@/server/providers/email";
import { passwordResetEmail, verifyEmailEmail, welcomeEmail } from "@/features/notifications/templates";
import type { TokenType } from "@/generated/prisma/enums";

const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
const RESET_TTL_MINUTES = 60;
const VERIFY_TTL_HOURS = 48;

async function issueToken(userId: string, type: TokenType, ttlMs: number) {
  const token = generateToken();
  await db.$transaction([
    // Apenas um token válido por tipo: invalida os anteriores.
    db.verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
    db.verificationToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) } }),
  ]);
  return token;
}

async function consumeToken(token: string, type: TokenType) {
  const record = await db.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt.getTime() < Date.now()) return null;
  // Consumo atômico: só um uso mesmo com requisições simultâneas.
  const { count } = await db.verificationToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1 ? record : null;
}

async function sendEmailSafely(message: { to: string; subject: string; html: string; text: string; template: string }) {
  try {
    await getEmailProvider().send(message);
  } catch (error) {
    logger.error("auth.email_failed", { template: message.template, error });
  }
}

export async function sendVerificationEmail(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", VERIFY_TTL_HOURS * 3600_000);
  const url = `${env.APP_URL}/verificar-email?token=${encodeURIComponent(token)}`;
  await sendEmailSafely({ to: user.email, ...verifyEmailEmail(user.name, url) });
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  cpf?: string;
  phone?: string;
  marketingOptIn?: boolean;
}) {
  const email = input.email.toLowerCase();
  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw conflict("Este e-mail já está cadastrado. Faça login ou recupere sua senha.");
  if (input.cpf) {
    const cpfTaken = await db.user.findUnique({ where: { cpf: input.cpf }, select: { id: true } });
    if (cpfTaken) throw conflict("Este CPF já está vinculado a outra conta.");
  }
  const user = await db.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      cpf: input.cpf ?? null,
      phone: input.phone ?? null,
      marketingOptIn: input.marketingOptIn ?? false,
      role: "CUSTOMER",
    },
    select: { id: true, name: true, email: true },
  });
  await sendVerificationEmail(user);
  await sendEmailSafely({ to: user.email, ...welcomeEmail(user.name) });
  return user;
}

/**
 * Autentica com proteção contra força bruta (bloqueio temporário por conta)
 * e tempo de resposta uniforme (hash fictício quando o e-mail não existe).
 * Mensagem de erro genérica para não revelar se o e-mail existe.
 */
export async function authenticate(emailRaw: string, password: string, ipAddress?: string) {
  const email = emailRaw.toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, status: true, failedLoginCount: true, lockedUntil: true },
  });
  const invalid = new AppError("UNAUTHENTICATED", "E-mail ou senha incorretos.");

  if (!user) {
    await verifyPassword(password, await getDummyHash());
    throw invalid;
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await verifyPassword(password, await getDummyHash());
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError("RATE_LIMITED", `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutes} min ou redefina sua senha.`);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined,
      },
    });
    await audit({ actorId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id, ipAddress });
    throw invalid;
  }
  if (user.status !== "ACTIVE") {
    throw new AppError("FORBIDDEN", "Sua conta está suspensa. Entre em contato com o suporte.");
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ipAddress });
  return { id: user.id };
}

/** Sempre conclui sem revelar se o e-mail existe. */
export async function requestPasswordReset(emailRaw: string) {
  const email = emailRaw.toLowerCase();
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, status: true } });
  if (!user || user.status !== "ACTIVE") return;
  const token = await issueToken(user.id, "PASSWORD_RESET", RESET_TTL_MINUTES * 60_000);
  const url = `${env.APP_URL}/redefinir-senha?token=${encodeURIComponent(token)}`;
  await sendEmailSafely({ to: user.email, ...passwordResetEmail(user.name, url) });
}

export async function isPasswordResetTokenValid(token: string) {
  const record = await db.verificationToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { type: true, usedAt: true, expiresAt: true } });
  return Boolean(record && record.type === "PASSWORD_RESET" && !record.usedAt && record.expiresAt.getTime() > Date.now());
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await consumeToken(token, "PASSWORD_RESET");
  if (!record) throw new AppError("UNPROCESSABLE", "Link inválido ou expirado. Solicite uma nova redefinição de senha.");
  await db.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(newPassword), failedLoginCount: 0, lockedUntil: null },
  });
  // Encerra todas as sessões: quem tinha acesso indevido perde a sessão.
  await destroyAllSessions(record.userId);
  await audit({ actorId: record.userId, action: "auth.password_reset", entityType: "User", entityId: record.userId });
}

export async function verifyEmailToken(token: string) {
  const record = await consumeToken(token, "EMAIL_VERIFICATION");
  if (!record) return false;
  await db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  return true;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId?: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError("VALIDATION", "Senha atual incorreta.", { fieldErrors: { currentPassword: ["Senha atual incorreta"] } });
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await destroyAllSessions(userId, keepSessionId);
  await audit({ actorId: userId, action: "auth.password_reset", entityType: "User", entityId: userId, after: { via: "change_password" } });
}
