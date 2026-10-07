import "server-only";
import { db } from "@/server/db";
import { getProductCards } from "@/features/catalog/cards.server";
import { getCategoryTree } from "@/features/catalog/categories.server";
import { getStoreSettings } from "@/features/settings/queries";
import { getStoreBenefits } from "@/features/home/benefits.server";
import type { CategoryNode } from "@/features/catalog/types";
import type { WelcomeCampaignView } from "@/features/coupons/campaign.server";
import { formatBRL } from "@/lib/money";
import { getActiveBanners } from "@/features/home/queries";
import { getCampaignHeroSlides } from "@/features/home/campaign-hero.server";

export type HeroSlideArt =
  | { kind: "image" }
  | { kind: "coupon"; code: string; headline: string }
  | { kind: "products"; images: { url: string; alt: string }[] }
  | { kind: "shipping" }
  | { kind: "brand" }
  /** Arte pronta (título, cupom e botão já desenhados): exibida inteira, sem texto por cima. */
  | {
      kind: "artwork";
      src: string;
      width: number;
      height: number;
      alt: string;
      /** Quadro exibido (proporção) e posição da imagem nele, em % — sem distorcer. */
      frame: { aspect: number; width: number; left: number; top: number };
    };

export type HeroSlide = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string;
  link: string;
  imageUrl: string | null;
  theme: "brand" | "sun" | "ink" | "coral" | "light";
  art: HeroSlideArt;
};

const TECH_SLUGS = ["celulares", "smartphones", "iphone", "eletronicos", "informatica"];
const THEMES = new Set<HeroSlide["theme"]>(["brand", "sun", "ink", "coral", "light"]);

function collect(nodes: CategoryNode[], slugs: Set<string>, inside = false, out: { ids: string[]; first: CategoryNode | null } = { ids: [], first: null }) {
  for (const n of nodes) {
    const hit = inside || slugs.has(n.slug);
    if (hit) {
      out.ids.push(n.id);
      if (!out.first && !inside) out.first = n;
    }
    collect(n.children, slugs, hit, out);
  }
  return out;
}

/**
 * Slides do carrossel principal: as artes oficiais da campanha (quando o cupom
 * está no ar); senão, os banners cadastrados no painel;
 * depois campanhas automáticas que SÓ entram quando são verdadeiras agora
 * (cupom ativo com produtos, tecnologia com produtos à venda, frete grátis
 * existente). Nada de promessa sem lastro nos dados.
 */
export async function getHeroSlides(welcome: WelcomeCampaignView | null): Promise<HeroSlide[]> {
  const [campaign, banners, tree, settings, benefits, freeShippingCount] = await Promise.all([
    getCategoryTree().then(getCampaignHeroSlides),
    getActiveBanners("HOME_HERO"),
    getCategoryTree(),
    getStoreSettings(),
    getStoreBenefits(),
    db.product.count({ where: { status: "ACTIVE", store: { status: "ACTIVE" }, freeShipping: true, totalStock: { gt: 0 } } }),
  ]);
  // Campanha oficial no ar: as artes ocupam o hero sozinhas.
  if (campaign.length) return campaign;

  const slides: HeroSlide[] = banners.map((b) => ({
    id: b.id,
    eyebrow: b.eyebrow,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.ctaLabel ?? "Confira",
    link: b.link,
    imageUrl: b.imageUrl,
    theme: THEMES.has(b.theme as HeroSlide["theme"]) ? (b.theme as HeroSlide["theme"]) : "brand",
    art: { kind: "image" },
  }));

  if (welcome) {
    slides.push({
      id: "auto-coupon",
      eyebrow: "Presente de boas-vindas",
      title: `${welcome.headline} para começar`,
      subtitle: `Seu primeiro achado na Mercatto ficou ainda melhor. Válido ${welcome.scopeLabel}.`,
      ctaLabel: "Aproveitar agora",
      link: welcome.href,
      imageUrl: null,
      theme: "brand",
      art: { kind: "coupon", code: welcome.code, headline: welcome.headline },
    });
  }

  const tech = collect(tree, new Set(TECH_SLUGS));
  if (tech.ids.length && tech.first) {
    const products = await getProductCards({ where: { categoryId: { in: tech.ids }, totalStock: { gt: 0 } }, orderBy: [{ discountPercent: "desc" }, { salesCount: "desc" }, { isFeatured: "desc" }], take: 6 });
    const withImage = products.filter((p) => p.imageUrl).slice(0, 3);
    if (withImage.length) {
      const hasDeals = products.some((p) => p.discountPercent > 0);
      // Parcelamento só quando o gateway aceita cartão de verdade.
      const installments = benefits.methods.includes("CREDIT_CARD") ? benefits.installments : 1;
      slides.push({
        id: "auto-tech",
        eyebrow: "Tecnologia",
        title: "Tecnologia que cabe no seu bolso",
        subtitle: hasDeals ? "Ofertas especiais em smartphones e eletrônicos." : installments > 1 ? `Smartphones e eletrônicos em até ${installments}x sem juros no cartão.` : "Smartphones, fones e acessórios para o seu dia a dia.",
        ctaLabel: hasDeals ? "Ver ofertas" : "Ver produtos",
        link: hasDeals ? `/ofertas?categoria=${tech.first.slug}` : `/categoria/${tech.first.slug}`,
        imageUrl: null,
        theme: "ink",
        art: { kind: "products", images: withImage.map((p) => ({ url: p.imageUrl!, alt: p.imageAlt })) },
      });
    }
  }

  if (freeShippingCount > 0) {
    slides.push({
      id: "auto-shipping",
      eyebrow: "Entrega",
      title: "Frete grátis em produtos selecionados",
      subtitle: settings.freeShippingThresholdCents ? `Compre mais, pague menos: produtos oficiais com frete grátis acima de ${formatBRL(settings.freeShippingThresholdCents)}.` : "Procure o selo “Frete grátis” e receba sem pagar a entrega.",
      ctaLabel: "Conferir",
      link: "/buscar?frete_gratis=1",
      imageUrl: null,
      theme: "light",
      art: { kind: "shipping" },
    });
  }

  if (!slides.length) {
    slides.push({
      id: "auto-brand",
      eyebrow: "Mercatto",
      title: "Achou. Gostou. É Mercatto.",
      subtitle: "Pagamento protegido e entrega acompanhada do início ao fim.",
      ctaLabel: "Explorar categorias",
      link: "/categorias",
      imageUrl: null,
      theme: "brand",
      art: { kind: "brand" },
    });
  }
  return slides.slice(0, 6);
}
