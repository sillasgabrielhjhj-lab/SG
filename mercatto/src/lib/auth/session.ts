import "server-only";
import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth/tokens";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "mercatto_session";
const SESSION_TTL_DAYS = 30;

async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent") ?? undefined,
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  };
}

export async function createSession(userId: string) {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const meta = await requestMeta();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const tokenHash = hashToken(raw);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (raw) {
    const tokenHash = hashToken(raw);
    await prisma.session
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Revoga todas as sessões ativas do usuário (ex: "sair de todos os
 * dispositivos" ou após uma troca de senha). */
export async function destroyAllSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
