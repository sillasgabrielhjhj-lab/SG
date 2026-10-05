import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mercatto — compre com confiança",
    short_name: "Mercatto",
    description: "Marketplace brasileiro com ofertas oficiais Mercatto e lojas parceiras verificadas.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/?utm_source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f6f4",
    theme_color: "#0b5c4d",
    categories: ["shopping"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ofertas do dia", url: "/ofertas" },
      { name: "Meus pedidos", url: "/minha-conta/pedidos" },
      { name: "Carrinho", url: "/carrinho" },
    ],
  };
}
