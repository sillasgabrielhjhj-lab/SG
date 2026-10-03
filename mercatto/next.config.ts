import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Next.js injeta scripts inline (payload de hidratação RSC) em toda
// página do App Router — isso exige 'unsafe-inline' em script-src (via
// nonce por requisição, ou assim, mais simples). Optamos pela abordagem
// sem nonce (documentada pelo próprio Next.js como caminho padrão) para
// não forçar renderização 100% dinâmica em toda a aplicação. O restante
// da política continua restrito: sem object-src, sem frame-ancestors,
// sem base-uri/form-action de terceiros — é aí que CSP ganha contra XSS
// de verdade (exfiltração via <base>/<form>/<object>, clickjacking, etc).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"), // Turbopack dev precisa de eval
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
