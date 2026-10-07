import "server-only";
import type { CategoryNode } from "@/features/catalog/types";
import { countEligibleProductsIn, findPromotableCoupon } from "@/features/coupons/campaign.server";
import type { HeroSlide } from "@/features/home/hero.server";

/**
 * Artes oficiais da campanha MERCATTO30 (public/banners, 2000×667). As artes
 * já trazem título, cupom e botão — o carrossel não sobrepõe nenhum texto.
 * Cada arte só entra no ar quando é verdade agora: o cupom está ativo (é
 * validado no servidor, no carrinho e no checkout) e aceita ao menos um
 * produto publicado da categoria para onde o banner leva.
 */
const CAMPAIGN_COUPON = "MERCATTO30";
const ART_WIDTH = 2000;
const ART_HEIGHT = 667;

const ARTWORKS = [
  {
    id: "mercatto30-tv-audio",
    src: "/banners/mercatto-tv-audio-30off.webp",
    alt: "Ofertas Mercatto de até 30% em TV, celular e áudio com cupom MERCATTO30",
    category: "tv-e-audio",
  },
  {
    id: "mercatto30-eletrodomesticos",
    src: "/banners/mercatto-eletrodomesticos-30off.webp",
    alt: "Ofertas Mercatto de até 30% em eletrodomésticos com cupom MERCATTO30",
    category: "eletrodomesticos",
  },
  {
    id: "mercatto30-celulares",
    src: "/banners/mercatto-celulares-acessorios-30off.webp",
    alt: "Ofertas Mercatto de até 30% em celulares e acessórios com cupom MERCATTO30",
    category: "celulares",
  },
] as const;

function findCategory(nodes: CategoryNode[], slug: string): CategoryNode | null {
  for (const n of nodes) {
    if (n.slug === slug) return n;
    const hit = findCategory(n.children, slug);
    if (hit) return hit;
  }
  return null;
}

function subtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(subtreeIds)];
}

export async function getCampaignHeroSlides(tree: CategoryNode[]): Promise<HeroSlide[]> {
  const coupon = await findPromotableCoupon(CAMPAIGN_COUPON);
  if (!coupon) return [];
  const slides = await Promise.all(
    ARTWORKS.map(async (art): Promise<HeroSlide | null> => {
      const category = findCategory(tree, art.category);
      if (!category || !(await countEligibleProductsIn(coupon, subtreeIds(category)))) return null;
      return {
        id: art.id,
        eyebrow: null,
        title: art.alt,
        subtitle: null,
        ctaLabel: "Ver ofertas",
        link: `/categoria/${category.slug}`,
        imageUrl: art.src,
        theme: "brand",
        art: { kind: "artwork", src: art.src, width: ART_WIDTH, height: ART_HEIGHT, alt: art.alt },
      };
    }),
  );
  return slides.filter((s): s is HeroSlide => s !== null);
}
