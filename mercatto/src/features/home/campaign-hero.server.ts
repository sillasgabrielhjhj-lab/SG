import "server-only";
import type { CategoryNode } from "@/features/catalog/types";
import { countEligibleProductsIn, findPromotableCoupon } from "@/features/coupons/campaign.server";
import type { HeroSlide } from "@/features/home/hero.server";

/**
 * Configuração ÚNICA da campanha do hero: cupom MERCATTO25 (25% OFF na
 * primeira compra) e suas artes oficiais (public/banners, 2000×667). As artes
 * já trazem título, cupom e botão — o carrossel não sobrepõe nenhum texto.
 * Cada arte só entra no ar quando é verdade agora: o cupom está ativo (é
 * validado no servidor, no carrinho e no checkout — primeira compra, limite
 * por cliente, categorias) e aceita ao menos um produto publicado da
 * categoria para onde o banner leva.
 */
export const HERO_CAMPAIGN_COUPON = "MERCATTO25";

const ART = { width: 2000, height: 667 } as const;
/** Proporção exibida: a das artes sem a moldura clara que duas delas trazem. */
const DISPLAY_ASPECT = 3.12;

type Crop = { x: number; y: number; w: number; h: number };

const ARTWORKS: { id: string; src: string; alt: string; category: string; crop: Crop }[] = [
  {
    id: "mercatto25-tv-audio",
    src: "/banners/mercatto-tv-audio-25off.webp",
    alt: "25% OFF na primeira compra em TV, celular e áudio na Mercatto com cupom MERCATTO25",
    category: "tv-e-audio",
    crop: { x: 17, y: 18, w: 1965, h: 626 },
  },
  {
    id: "mercatto25-eletrodomesticos",
    src: "/banners/mercatto-eletrodomesticos-25off.webp",
    alt: "25% OFF na primeira compra em eletrodomésticos na Mercatto com cupom MERCATTO25",
    category: "eletrodomesticos",
    crop: { x: 17, y: 17, w: 1965, h: 632 },
  },
  {
    id: "mercatto25-celulares",
    src: "/banners/mercatto-celulares-acessorios-25off.webp",
    alt: "25% OFF na primeira compra em celulares e acessórios na Mercatto com cupom MERCATTO25",
    category: "celulares",
    crop: { x: 0, y: 0, w: ART.width, h: ART.height },
  },
];

/**
 * Posição da imagem (em % do quadro) para que a área `crop` cubra o quadro
 * sem distorcer — esconde a moldura desenhada em algumas artes sem editar
 * o arquivo.
 */
function framing(crop: Crop) {
  const scale = Math.max(1 / crop.w, 1 / (DISPLAY_ASPECT * crop.h)); // por unidade de largura do quadro
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    aspect: DISPLAY_ASPECT,
    width: round(ART.width * scale * 100),
    left: round(50 - (crop.x + crop.w / 2) * scale * 100),
    top: round(50 - (crop.y + crop.h / 2) * scale * DISPLAY_ASPECT * 100),
  };
}

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
  const coupon = await findPromotableCoupon(HERO_CAMPAIGN_COUPON);
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
        ctaLabel: "Aproveitar agora",
        link: `/categoria/${category.slug}`,
        imageUrl: art.src,
        theme: "brand",
        art: { kind: "artwork", src: art.src, width: ART.width, height: ART.height, alt: art.alt, frame: framing(art.crop) },
      };
    }),
  );
  return slides.filter((s): s is HeroSlide => s !== null);
}
