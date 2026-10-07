import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { publicProductWhere } from "@/features/catalog/cards.server";
import { getCategoryAncestorsMap, getCategoryTree } from "@/features/catalog/categories.server";
import type { CategoryNode } from "@/features/catalog/types";

/** Categorias com ao menos um produto à venda (e seus ancestrais). */
export const getStockedCategoryIds = cache(async (): Promise<Set<string>> => {
  const [rows, ancestors] = await Promise.all([db.product.groupBy({ by: ["categoryId"], where: publicProductWhere }), getCategoryAncestorsMap()]);
  const ids = new Set<string>();
  for (const { categoryId } of rows) {
    ids.add(categoryId);
    for (const a of ancestors.get(categoryId) ?? []) ids.add(a);
  }
  return ids;
});

/**
 * Árvore para a navegação pública (menu, home, "Todas as categorias"): só
 * categorias com produto à venda. As vazias continuam no painel e voltam
 * sozinhas ao receber produtos.
 */
export const getNavCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  const [tree, stocked] = await Promise.all([getCategoryTree(), getStockedCategoryIds()]);
  const prune = (nodes: CategoryNode[]): CategoryNode[] => nodes.filter((n) => stocked.has(n.id)).map((n) => ({ ...n, children: prune(n.children) }));
  return prune(tree);
});
