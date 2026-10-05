import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/features/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/minha-conta", "/vendedor", "/admin", "/checkout", "/carrinho", "/api/", "/entrar", "/cadastro", "/recuperar-senha", "/redefinir-senha", "/verificar-email", "/acesso-negado", "/buscar?"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
