import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/search",
        "/entrar",
        "/cadastro",
        "/recuperar-senha",
        "/redefinir-senha/",
        "/verificar-email/",
        "/carrinho",
        "/checkout",
        "/pedido-confirmado/",
        "/minha-conta",
        "/minha-conta/",
        "/vendedor",
        "/vendedor/",
        "/admin",
        "/admin/",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
