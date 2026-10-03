"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { sendEmail, verificationEmailHtml, passwordResetEmailHtml } from "@/lib/email";
import {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ip = await clientIp();
  // Limite generoso de propósito: IPs compartilhados (escritório, wifi
  // público, CGNAT) podem ter várias pessoas se cadastrando da mesma
  // rede em pouco tempo — isso não deveria bloquear gente de verdade.
  const { allowed } = await rateLimit(`register:ip:${ip}`, 30, 60 * 60);
  if (!allowed) {
    return { status: "error", message: "Muitas tentativas. Tente novamente mais tarde." };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return {
      status: "error",
      fieldErrors: { email: ["Já existe uma conta com este e-mail"] },
    };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, email: normalizedEmail, passwordHash },
  });

  await logAudit({ userId: user.id, action: "USER_REGISTERED", entityType: "User", entityId: user.id });

  const { raw, hash } = generateToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Confirme seu e-mail na Mercatto",
    html: verificationEmailHtml(`${APP_URL}/verificar-email/${raw}`),
  });

  await createSession(user.id);
  redirect("/");
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ip = await clientIp();

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();

  const { allowed: ipAllowed } = await rateLimit(`login:ip:${ip}`, 20, 15 * 60);
  const { allowed: emailAllowed } = await rateLimit(
    `login:email:${normalizedEmail}`,
    5,
    15 * 60,
  );

  const genericError = { status: "error" as const, message: "E-mail ou senha incorretos." };

  if (!ipAllowed || !emailAllowed) {
    return {
      status: "error",
      message: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
    };
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return genericError;
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    await logAudit({ userId: user.id, action: "LOGIN_FAILED", entityType: "User", entityId: user.id });
    return genericError;
  }

  await createSession(user.id);
  await logAudit({ userId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id });

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/");
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ip = await clientIp();

  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();

  const { allowed } = await rateLimit(`pwreset:${ip}:${normalizedEmail}`, 5, 60 * 60);

  // Mensagem sempre genérica — não revela se o e-mail existe na base
  // (evita enumeração de contas).
  const genericSuccess: ActionState = {
    status: "success",
    message: "Se esse e-mail estiver cadastrado, enviamos instruções de recuperação.",
  };

  if (!allowed) return genericSuccess;

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return genericSuccess;

  const { raw, hash } = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Redefinição de senha — Mercatto",
    html: passwordResetEmailHtml(`${APP_URL}/redefinir-senha/${raw}`),
  });

  await logAudit({ userId: user.id, action: "PASSWORD_RESET_REQUESTED", entityType: "User", entityId: user.id });

  return genericSuccess;
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { status: "error", message: "Link inválido ou expirado. Solicite uma nova recuperação de senha." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logAudit({
    userId: resetToken.userId,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: resetToken.userId,
  });

  return { status: "success", message: "Senha redefinida com sucesso. Você já pode entrar." };
}

export async function verifyEmailToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
    return { success: false as const };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await logAudit({
    userId: verificationToken.userId,
    action: "EMAIL_VERIFIED",
    entityType: "User",
    entityId: verificationToken.userId,
  });

  return { success: true as const };
}
