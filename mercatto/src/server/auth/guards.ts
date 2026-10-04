import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/server/auth/session";
import { hasPermission, type Permission } from "@/server/auth/rbac";
import { forbidden, unauthenticated } from "@/server/errors";

/**
 * Data Access Layer de autorização. Toda Server Action, Route Handler e
 * página protegida DEVE passar por estes guards — o proxy (middleware) faz
 * apenas redirecionamento otimista e não é uma barreira de segurança.
 */

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** Para Server Actions/Route Handlers: lança AppError. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) throw forbidden();
  return user;
}

/** Vendedor com loja ativa. Retorna o usuário e o id da loja (escopo de dados). */
export async function requireSeller(): Promise<SessionUser & { storeId: string }> {
  const user = await requirePermission("seller:access");
  if (!user.storeId) throw forbidden("Crie sua loja para acessar o painel do vendedor.");
  return user as SessionUser & { storeId: string };
}

// ---------------------------------------------------------------------------
// Variantes para páginas (Server Components): redirecionam em vez de lançar.
// ---------------------------------------------------------------------------

export async function requireUserPage(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?redirect=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requirePermissionPage(permission: Permission, returnTo: string): Promise<SessionUser> {
  const user = await requireUserPage(returnTo);
  if (!hasPermission(user.role, permission)) redirect("/acesso-negado");
  return user;
}

export async function requireSellerPage(returnTo: string): Promise<SessionUser & { storeId: string }> {
  const user = await requireUserPage(returnTo);
  if (!hasPermission(user.role, "seller:access")) redirect("/vender");
  if (!user.storeId) redirect("/vender");
  return user as SessionUser & { storeId: string };
}
