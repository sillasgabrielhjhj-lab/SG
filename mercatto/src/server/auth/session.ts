import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/server/db";
import { isProduction } from "@/server/env";
import { generateToken, hashToken } from "@/server/auth/tokens";
import type { Role, UserStatus } from "@/generated/prisma/enums";

export const SESSION_COOKIE = isProduction ? "__Host-mrc_session" : "mrc_session";
const SESSION_TTL_DAYS = 30;
const SESSION_RENEW_THRESHOLD_DAYS = 15;
const DAY = 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  storeId: string | null;
  storeSlug: string | null;
  isOfficialStore: boolean;
};

export async function createSession(userId: string, meta?: { ipAddress?: string; userAgent?: string | null }) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent ?? undefined,
    },
  });
  await setSessionCookie(token, expiresAt);
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

/**
 * Valida o cookie de sessão. Memoizado por requisição (React cache).
 * Renova a expiração (sliding session) quando próxima do fim.
 */
export const getSession = cache(async (): Promise<{ user: SessionUser; sessionId: string } | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          store: { select: { id: true, slug: true, isOfficial: true } },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now() || session.user.status !== "ACTIVE") {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (session.expiresAt.getTime() - Date.now() < SESSION_RENEW_THRESHOLD_DAYS * DAY) {
    // Cookies só podem ser alterados em Server Actions/Route Handlers; em
    // Server Components a renovação é adiada para a próxima ação do usuário.
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY);
    const renewed = await setSessionCookie(token, expiresAt).then(
      () => true,
      () => false,
    );
    if (renewed) {
      await db.session.update({ where: { id: session.id }, data: { expiresAt, lastUsedAt: new Date() } });
    }
  }

  const { store: userStore, ...user } = session.user;
  return {
    sessionId: session.id,
    user: {
      ...user,
      storeId: userStore?.id ?? null,
      storeSlug: userStore?.slug ?? null,
      isOfficialStore: userStore?.isOfficial ?? false,
    },
  };
});

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Encerra todas as sessões do usuário (troca de senha, suspensão). */
export async function destroyAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}

export async function purgeExpiredSessions() {
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
