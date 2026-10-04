/**
 * Tipos de leitura (read models) do catálogo compartilhados entre vitrine,
 * busca, categoria, loja, favoritos e recomendações.
 */
export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string;
  brandName: string | null;
  storeName: string;
  storeSlug: string;
  isOfficial: boolean; // vendido pela Mercatto
  condition: "NEW" | "USED" | "REFURBISHED";
  priceCents: number; // preço efetivo (com promoção)
  listPriceCents: number | null; // preço "de" riscado
  discountPercent: number;
  freeShipping: boolean;
  totalStock: number;
  salesCount: number;
  ratingAvg: number;
  ratingCount: number;
  promotion: {
    id: string;
    name: string;
    isFlash: boolean;
    endsAt: string; // ISO (serializável para client components)
    stockLimit: number | null;
    soldCount: number;
  } | null;
  /** Quantidade de variantes ativas (para CTA "Ver opções" vs "Adicionar"). */
  variantCount: number;
  /** Variante padrão (primeira ativa com estoque) para adicionar direto ao carrinho. */
  defaultVariantId: string | null;
  isDemo: boolean;
};

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  imageUrl: string | null;
  parentId: string | null;
  position: number;
  isFeatured: boolean;
  children: CategoryNode[];
};
