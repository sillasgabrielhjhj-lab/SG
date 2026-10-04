import { absoluteUrl, siteUrl, SITE_NAME } from "@/features/seo/site";

/**
 * Dados estruturados Schema.org. Serialização segura contra quebra de
 * <script> (escape de "<"). NUNCA inclua aggregateRating baseado em dados
 * DEMO/fictícios — passe apenas contagens de avaliações reais.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/ | /g, "");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function organizationJsonLd(input: { name?: string; logoUrl?: string | null; sameAs?: string[]; email?: string | null; phone?: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name ?? SITE_NAME,
    url: siteUrl(),
    logo: absoluteUrl(input.logoUrl ?? "/brand/logo.svg"),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
    ...(input.email || input.phone
      ? { contactPoint: [{ "@type": "ContactPoint", contactType: "customer service", email: input.email ?? undefined, telephone: input.phone ?? undefined, areaServed: "BR", availableLanguage: "pt-BR" }] }
      : {}),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl(),
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/buscar?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export type ProductJsonLdInput = {
  name: string;
  slug: string;
  description: string;
  images: string[];
  sku: string;
  gtin?: string | null;
  brandName?: string | null;
  condition: "NEW" | "USED" | "REFURBISHED";
  sellerName: string;
  /** Ofertas por variante (preço efetivo em centavos). */
  offers: { sku: string; priceCents: number; inStock: boolean; priceValidUntil?: Date | null }[];
  /** Somente avaliações REAIS (isDemo = false). Omitir quando 0. */
  realRating?: { average: number; count: number } | null;
};

const CONDITION: Record<ProductJsonLdInput["condition"], string> = {
  NEW: "https://schema.org/NewCondition",
  USED: "https://schema.org/UsedCondition",
  REFURBISHED: "https://schema.org/RefurbishedCondition",
};

const toPrice = (cents: number) => (cents / 100).toFixed(2);

export function productJsonLd(p: ProductJsonLdInput) {
  const url = absoluteUrl(`/produto/${p.slug}`);
  const prices = p.offers.map((o) => o.priceCents);
  const anyInStock = p.offers.some((o) => o.inStock);
  const offers =
    p.offers.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "BRL",
          lowPrice: toPrice(Math.min(...prices)),
          highPrice: toPrice(Math.max(...prices)),
          offerCount: p.offers.length,
          availability: anyInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: CONDITION[p.condition],
          url,
          seller: { "@type": "Organization", name: p.sellerName },
        }
      : p.offers[0]
        ? {
            "@type": "Offer",
            priceCurrency: "BRL",
            price: toPrice(p.offers[0].priceCents),
            availability: p.offers[0].inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: CONDITION[p.condition],
            url,
            seller: { "@type": "Organization", name: p.sellerName },
            ...(p.offers[0].priceValidUntil ? { priceValidUntil: p.offers[0].priceValidUntil.toISOString().slice(0, 10) } : {}),
          }
        : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description.slice(0, 5000),
    image: p.images.map((i) => absoluteUrl(i)),
    sku: p.sku,
    ...(p.gtin ? { gtin13: p.gtin } : {}),
    ...(p.brandName ? { brand: { "@type": "Brand", name: p.brandName } } : {}),
    url,
    ...(offers ? { offers } : {}),
    ...(p.realRating && p.realRating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.realRating.average.toFixed(1),
            reviewCount: p.realRating.count,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };
}
