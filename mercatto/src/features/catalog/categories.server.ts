import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { memoize } from "@/server/memo";
import type { CategoryNode } from "@/features/catalog/types";

/** Todas as categorias ativas (tabela pequena) — 2 min em memória e memoizado por requisição. */
export const categoriesMemo = memoize(120_000, () =>
  db.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, icon: true, imageUrl: true, parentId: true, position: true, isFeatured: true },
  }),
);

export const getAllCategories = cache(() => categoriesMemo.get());

export const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  const all = await getAllCategories();
  const byId = new Map<string, CategoryNode>(all.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    if (!node.parentId) roots.push(node);
    // Subcategoria de categoria desativada some junto (não vira categoria raiz).
    else byId.get(node.parentId)?.children.push(node);
  }
  return roots;
});

/** Mapa categoria -> lista de ancestrais (do pai até a raiz). */
export const getCategoryAncestorsMap = cache(async (): Promise<Map<string, string[]>> => {
  const all = await db.category.findMany({ select: { id: true, parentId: true } });
  const parent = new Map(all.map((c) => [c.id, c.parentId]));
  const result = new Map<string, string[]>();
  for (const c of all) {
    const chain: string[] = [];
    let cur = parent.get(c.id) ?? null;
    let guard = 0;
    while (cur && guard++ < 10) {
      chain.push(cur);
      cur = parent.get(cur) ?? null;
    }
    result.set(c.id, chain);
  }
  return result;
});

/** Ids da categoria e de todas as descendentes (para filtrar produtos). */
export async function getCategoryWithDescendantIds(categoryId: string): Promise<string[]> {
  const all = await db.category.findMany({ select: { id: true, parentId: true } });
  const children = new Map<string, string[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    children.set(c.parentId, [...(children.get(c.parentId) ?? []), c.id]);
  }
  const out: string[] = [];
  const stack = [categoryId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

/** Trilha de navegação (raiz -> categoria). */
export async function getCategoryBreadcrumb(categoryId: string) {
  const all = await getAllCategories();
  const byId = new Map(all.map((c) => [c.id, c]));
  const trail: { id: string; name: string; slug: string }[] = [];
  let cur = byId.get(categoryId);
  let guard = 0;
  while (cur && guard++ < 10) {
    trail.unshift({ id: cur.id, name: cur.name, slug: cur.slug });
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return trail;
}
