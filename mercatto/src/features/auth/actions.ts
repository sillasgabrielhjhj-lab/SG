"use server";

import { redirect } from "next/navigation";
import { createAction, ok, runAction } from "@/server/action";
import { getSession, createSession, destroyCurrentSession } from "@/server/auth/session";
import { requireUser } from "@/server/auth/guards";
import { getClientIp, getUserAgent } from "@/server/security/request";
import { enforceRateLimit } from "@/server/security/rate-limit";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeRedirectPath,
} from "@/features/auth/schemas";
import {
  authenticate,
  changePassword,
  registerUser,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} from "@/features/auth/service";
import { onUserSignedIn } from "@/features/auth/hooks.server";
import { db } from "@/server/db";

/** Login. Em caso de sucesso retorna o destino seguro para o cliente navegar. */
export const loginAction = createAction(
  loginSchema,
  async ({ email, password, redirect: to }) => {
    const ip = await getClientIp();
    await enforceRateLimit(`login:ip:${ip}`, 30, 15 * 60);
    await enforceRateLimit(`login:email:${email}`, 10, 15 * 60);
    const user = await authenticate(email, password, ip);
    await createSession(user.id, { ipAddress: ip, userAgent: await getUserAgent() });
    await onUserSignedIn(user.id);
    return ok({ redirectTo: safeRedirectPath(to, "/") }, "Bem-vindo de volta!");
  },
  "auth.login",
);

export const registerAction = createAction(
  registerSchema,
  async (input) => {
    const ip = await getClientIp();
    await enforceRateLimit(`register:ip:${ip}`, 10, 60 * 60);
    const user = await registerUser(input);
    await createSession(user.id, { ipAddress: ip, userAgent: await getUserAgent() });
    await onUserSignedIn(user.id);
    return ok({ redirectTo: safeRedirectPath(input.redirect, "/minha-conta") }, "Conta criada! Enviamos um e-mail para confirmar seu endereço.");
  },
  "auth.register",
);

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/");
}

export const forgotPasswordAction = createAction(
  forgotPasswordSchema,
  async ({ email }) => {
    const ip = await getClientIp();
    await enforceRateLimit(`forgot:ip:${ip}`, 10, 60 * 60);
    await enforceRateLimit(`forgot:email:${email}`, 3, 60 * 60);
    await requestPasswordReset(email);
    return ok(undefined, "Se houver uma conta com este e-mail, você receberá um link para redefinir a senha.");
  },
  "auth.forgot",
);

export const resetPasswordAction = createAction(
  resetPasswordSchema,
  async ({ token, password }) => {
    const ip = await getClientIp();
    await enforceRateLimit(`reset:ip:${ip}`, 10, 60 * 60);
    await resetPassword(token, password);
    return ok(undefined, "Senha redefinida! Entre com a nova senha.");
  },
  "auth.reset",
);

export const changePasswordAction = createAction(
  changePasswordSchema,
  async ({ currentPassword, password }) => {
    const user = await requireUser();
    await enforceRateLimit(`changepw:${user.id}`, 5, 15 * 60);
    const session = await getSession();
    await changePassword(user.id, currentPassword, password, session?.sessionId);
    return ok(undefined, "Senha alterada. As outras sessões foram encerradas.");
  },
  "auth.change_password",
);

export async function resendVerificationAction() {
  return runAction(async () => {
    const user = await requireUser();
    await enforceRateLimit(`verify-resend:${user.id}`, 3, 60 * 60);
    const full = await db.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, emailVerifiedAt: true } });
    if (!full || full.emailVerifiedAt) return ok(undefined, "Seu e-mail já está confirmado.");
    await sendVerificationEmail(full);
    return ok(undefined, "Enviamos um novo link de confirmação para o seu e-mail.");
  }, "auth.resend_verification");
}

/** Encerra todas as outras sessões do usuário (página Segurança). */
export async function logoutOtherSessionsAction() {
  return runAction(async () => {
    const user = await requireUser();
    const session = await getSession();
    await db.session.deleteMany({ where: { userId: user.id, id: { not: session?.sessionId ?? "" } } });
    return ok(undefined, "Outras sessões encerradas.");
  }, "auth.logout_others");
}
