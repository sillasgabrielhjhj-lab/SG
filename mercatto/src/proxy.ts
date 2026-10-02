import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "mercatto_session";
const PROTECTED_PREFIXES = ["/minha-conta", "/vendedor", "/admin", "/checkout"];

/**
 * Checagem rápida só de presença de cookie, para UX (evita renderizar a
 * página e só então redirecionar). A autorização de verdade (sessão
 * válida no banco + papel do usuário) acontece sempre no servidor, dentro
 * de cada layout/página protegida — nunca confiamos só nisto aqui.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) return NextResponse.next();

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = new URL("/entrar", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|placeholders).*)"],
};
