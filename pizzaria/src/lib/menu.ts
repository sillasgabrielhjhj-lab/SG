import { categories } from '@/data/categories';
import { products } from '@/data/menu';
import { optionGroups } from '@/data/options';
import type { CategoryId, OptionGroup, OptionItem, Product, ProductTag } from '@/types/menu';
import { normalizeText } from './utils';

const productById = new Map(products.map((p) => [p.id, p]));

export function getProduct(id: string | undefined | null): Product | undefined {
  return id ? productById.get(id) : undefined;
}

export function getCategory(id: CategoryId) {
  return categories.find((c) => c.id === id);
}

export function isAvailable(product: Product): boolean {
  return product.available !== false;
}

export const featuredProducts = products.filter((p) => p.featured);

export const tagLabels: Record<ProductTag, string> = {
  'mais-pedido': 'Mais pedido',
  vegetariano: 'Vegetariano',
  picante: 'Picante',
  novidade: 'Novidade',
  chef: 'Sugestão do chef',
};

/** Menor preço do produto (para exibir "a partir de"). */
export function getStartingPrice(product: Product): number {
  if (product.sizes?.length) return Math.min(...product.sizes.map((s) => s.price));
  return product.price ?? 0;
}

export function hasMultiplePrices(product: Product): boolean {
  return (product.sizes?.length ?? 0) > 1;
}

/** Produto precisa abrir o modal (tem tamanhos ou opções)? */
export function needsCustomization(product: Product): boolean {
  return Boolean(product.sizes?.length || product.optionGroups?.length || product.halfAndHalf);
}

export function getOptionGroups(product: Product): OptionGroup[] {
  return (product.optionGroups ?? [])
    .map((id) => optionGroups[id])
    .filter((g): g is OptionGroup => Boolean(g));
}

/** Resolve as opções de um grupo (fixas ou geradas a partir de uma categoria). */
export function getGroupOptions(group: OptionGroup): OptionItem[] {
  if (group.options) return group.options;
  if (group.fromCategory) {
    return products
      .filter((p) => p.category === group.fromCategory && isAvailable(p))
      .map((p) => ({ id: p.id, name: p.name, price: 0 }));
  }
  return [];
}

/** Sabores que podem ser combinados no meio a meio com o produto, no tamanho escolhido. */
export function getHalfAndHalfCandidates(product: Product, sizeId: string | undefined): Product[] {
  if (!product.halfAndHalf) return [];
  return products.filter(
    (p) =>
      p.id !== product.id &&
      p.halfAndHalf === product.halfAndHalf &&
      isAvailable(p) &&
      (!sizeId || p.sizes?.some((s) => s.id === sizeId)),
  );
}

/** Busca por nome, ingredientes e selos, ignorando acentos. */
export function matchesSearch(product: Product, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const haystack = normalizeText(
    [
      product.name,
      product.description,
      getCategory(product.category)?.name ?? '',
      ...(product.tags ?? []).map((t) => tagLabels[t]),
    ].join(' '),
  );
  return q.split(/\s+/).every((term) => haystack.includes(term));
}
