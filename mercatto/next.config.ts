import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Mercado Pago (Card Payment Brick): SDK, APIs de tokenização e iframes seguros.
const mercadoPago = process.env.PAYMENT_PROVIDER === "mercadopago";
const mpScript = mercadoPago ? " https://sdk.mercadopago.com https://http2.mlstatic.com" : "";
const mpConnect = mercadoPago ? " https://api.mercadopago.com https://api.mercadolibre.com https://*.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com" : "";
const mpFrame = mercadoPago ? " https://*.mercadopago.com https://*.mercadolibre.com https://*.mercadolivre.com" : "";

/**
 * Content-Security-Policy. 'unsafe-inline' em scripts é necessário para a
 * hidratação do Next.js sem nonce (páginas estáticas/ISR). XSS é mitigado
 * também por escape automático do React e ausência de dangerouslySetInnerHTML
 * com dados de usuário (JSON-LD é serializado com escape).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${mpScript}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://viacep.com.br" + mpConnect + (isDev ? " ws: wss:" : ""),
  `frame-src 'self'${mpFrame}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
    localPatterns: [{ pathname: "/uploads/**" }, { pathname: "/demo/**" }, { pathname: "/brand/**" }],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Áreas privadas nunca devem ser armazenadas em cache compartilhado.
        source: "/(minha-conta|vendedor|admin|checkout|carrinho)(.*)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
