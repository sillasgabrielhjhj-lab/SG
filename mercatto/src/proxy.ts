import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (antigo middleware) — apenas redirecionamento OTIMISTA de áreas
 * privadas quando não há cookie de sessão. A autorização real acontece no
 * servidor (src/server/auth/guards.ts) em cada página, action e rota.
 */
const PROTECTED_PREFIXES = ["/minha-conta", "/vendedor", "/admin", "/checkout"];
const SESSION_COOKIES = ["__Host-mrc_session", "mrc_session"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = `?redirect=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/minha-conta/:path*", "/vendedor/:path*", "/admin/:path*", "/checkout/:path*"],
};
