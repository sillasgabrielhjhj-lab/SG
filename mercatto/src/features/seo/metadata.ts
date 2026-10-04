import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_DESCRIPTION, SITE_NAME } from "@/features/seo/site";

/**
 * Monta metadata consistente: canonical, Open Graph, Twitter Cards e robots.
 * `path` é o caminho canônico (sem parâmetros de filtro/paginação irrelevantes).
 */
export function buildMetadata(input: {
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
  imageAlt?: string;
  noindex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const description = (input.description ?? DEFAULT_DESCRIPTION).slice(0, 300);
  const url = absoluteUrl(input.path);
  const images = input.image ? [{ url: absoluteUrl(input.image), alt: input.imageAlt ?? input.title }] : undefined;
  return {
    title: input.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: input.type ?? "website",
      locale: "pt_BR",
      siteName: SITE_NAME,
      title: input.title,
      description,
      url,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: input.title,
      description,
      images: images?.map((i) => i.url),
    },
    robots: input.noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

/** Metadata para áreas privadas (conta, painéis, checkout): nunca indexar. */
export const privateMetadata = (title: string): Metadata => ({
  title,
  robots: { index: false, follow: false, nocache: true },
});
