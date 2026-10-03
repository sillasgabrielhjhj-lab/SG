import "server-only";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import type { Role } from "@/generated/prisma/enums";

export async function getCurrentUser() {
  return getSessionUser();
}

export async function requireUser(redirectTo = "/entrar") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`${redirectTo}?next=${encodeURIComponent(redirectTo)}`);
  }
  return user;
}

/** Garante que o usuário autenticado tenha um dos papéis permitidos.
 * Usuários comuns nunca alcançam rotas de vendedor/admin por aqui — a
 * checagem acontece no servidor, nunca confiando em estado do cliente. */
export async function requireRole(roles: Role[], redirectTo = "/entrar") {
  const user = await requireUser(redirectTo);
  if (!roles.includes(user.role)) {
    redirect("/");
  }
  return user;
}
