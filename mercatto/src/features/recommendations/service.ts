import "server-only";
import { db } from "@/server/db";
import { getProductCards } from "@/features/catalog/cards.server";
import { matchText } from "@/features/search/service";
import type { ProductCardData } from "@/features/catalog/types";

export type RecommendationSignals = {
  /** Produtos vistos (mais recentes primeiro). */
  viewed: string[];
  /** Buscas recentes. */
  terms: string[];
  /** Produtos que já aparecem na página (não repetir). */
  exclude: string[];
};

const LIMIT = 12;

/**
 * "Recomendados para você", em camadas:
 *  1. afinidade — categorias e marcas dos produtos vistos e das buscas recentes,
 *     ordenadas por popularidade (vendas, avaliação, visualizações);
 *  2. completa com os mais populares da loja (fallback sem dados suficientes).
 * Nunca devolve o que o cliente acabou de ver nem o que já está na página.
 * Ponto único para evoluir (ex.: co-compra, histórico de pedidos).
 */
export async function recommendProducts(signals: RecommendationSignals): Promise<{ items: ProductCardData[]; personalized: boolean }> {
  const skip = new Set([...signals.viewed, ...signals.exclude]);
  const [viewedRows, termMatches] = await Promise.all([
    signals.viewed.length ? db.product.findMany({ where: { id: { in: signals.viewed } }, select: { categoryId: true, brandId: true } }) : Promise.resolve([]),
    Promise.all(signals.terms.slice(0, 3).map((t) => matchText(t).then((rows) => rows.slice(0, 6).map((r) => r.id)))),
  ]);
  const termIds = [...new Set(termMatches.flat())];
  const termRows = termIds.length ? await db.product.findMany({ where: { id: { in: termIds } }, select: { categoryId: true, brandId: true } }) : [];
  const categoryIds = [...new Set([...viewedRows, ...termRows].map((r) => r.categoryId))];
  const brandIds = [...new Set([...viewedRows, ...termRows].map((r) => r.brandId).filter((b): b is string => Boolean(b)))];

  const items: ProductCardData[] = [];
  const push = (cards: ProductCardData[]) => {
    for (const c of cards) {
      if (items.length >= LIMIT || skip.has(c.id)) continue;
      skip.add(c.id);
      items.push(c);
    }
  };

  // Produtos que bateram diretamente com as buscas vêm primeiro.
  if (termIds.length) push(await getProductCards({ where: { id: { in: termIds }, totalStock: { gt: 0 } }, orderBy: [{ salesCount: "desc" }], take: LIMIT }));
  if (categoryIds.length || brandIds.length) {
    push(
      await getProductCards({
        where: { id: { notIn: [...skip] }, totalStock: { gt: 0 }, OR: [...(categoryIds.length ? [{ categoryId: { in: categoryIds } }] : []), ...(brandIds.length ? [{ brandId: { in: brandIds } }] : [])] },
        orderBy: [{ salesCount: "desc" }, { ratingAvg: "desc" }, { viewCount: "desc" }],
        take: LIMIT * 2,
      }),
    );
  }
  const personalized = items.length >= 2;
  if (items.length < LIMIT) {
    push(await getProductCards({ where: { id: { notIn: [...skip] }, totalStock: { gt: 0 } }, orderBy: [{ viewCount: "desc" }, { salesCount: "desc" }, { ratingAvg: "desc" }], take: LIMIT * 2 }));
  }
  return { items, personalized };
}
