import { siteConfig } from '@/config/site';
import type { CartItem, FulfillmentMode, ItemSelection } from '@/types/cart';
import type { Product } from '@/types/menu';
import { toCents } from './format';
import { getGroupOptions, getOptionGroups, getProduct, isAvailable } from './menu';

/** Preço base (em centavos) de um produto num tamanho. */
function basePriceCents(product: Product, sizeId?: string): number | null {
  if (product.sizes?.length) {
    const size = product.sizes.find((s) => s.id === sizeId);
    return size ? toCents(size.price) : null;
  }
  return toCents(product.price ?? 0);
}

/**
 * Preço unitário (em centavos) de uma seleção.
 * Meio a meio: vale o maior preço entre os dois sabores (regra mais comum).
 * Retorna null se a seleção for inválida (produto/tamanho inexistente).
 */
export function getUnitPriceCents(selection: ItemSelection): number | null {
  const product = getProduct(selection.productId);
  if (!product) return null;

  let base = basePriceCents(product, selection.sizeId);
  if (base === null) return null;

  if (selection.halfProductId) {
    const half = getProduct(selection.halfProductId);
    const halfBase = half ? basePriceCents(half, selection.sizeId) : null;
    if (halfBase === null) return null;
    base = Math.max(base, halfBase);
  }

  let extras = 0;
  for (const group of getOptionGroups(product)) {
    const chosen = selection.options[group.id] ?? [];
    const options = getGroupOptions(group);
    for (const optionId of chosen) {
      const option = options.find((o) => o.id === optionId);
      if (option) extras += toCents(option.price);
    }
  }

  return base + extras;
}

/** Valida uma seleção contra o cardápio atual. Retorna a primeira mensagem de erro, se houver. */
export function validateSelection(selection: ItemSelection): string | null {
  const product = getProduct(selection.productId);
  if (!product) return 'Produto indisponível.';
  if (!isAvailable(product)) return `${product.name} está esgotado no momento.`;
  if (product.sizes?.length && !product.sizes.some((s) => s.id === selection.sizeId)) {
    return 'Escolha um tamanho.';
  }
  for (const group of getOptionGroups(product)) {
    const chosen = selection.options[group.id] ?? [];
    if (group.required && chosen.length === 0) return `Escolha: ${group.title.toLowerCase()}.`;
    if (group.type === 'single' && chosen.length > 1) return `Escolha apenas 1 em ${group.title.toLowerCase()}.`;
    if (group.max && chosen.length > group.max) return `Máximo de ${group.max} em ${group.title.toLowerCase()}.`;
  }
  return null;
}

/** Item do carrinho com dados resolvidos para exibição. */
export interface ResolvedCartItem {
  item: CartItem;
  product: Product;
  halfProduct?: Product;
  sizeLabel?: string;
  /** Linhas de detalhe: borda, adicionais, sabores... */
  details: string[];
  unitCents: number;
  totalCents: number;
}

export function resolveCartItem(item: CartItem): ResolvedCartItem | null {
  const product = getProduct(item.productId);
  const unitCents = getUnitPriceCents(item);
  if (!product || unitCents === null) return null;

  const size = product.sizes?.find((s) => s.id === item.sizeId);
  const halfProduct = item.halfProductId ? getProduct(item.halfProductId) : undefined;

  const details: string[] = [];
  for (const group of getOptionGroups(product)) {
    const chosen = item.options[group.id] ?? [];
    if (!chosen.length) continue;
    const options = getGroupOptions(group);
    const names = chosen
      .map((id) => options.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
      .map((o) => o.name);
    if (names.length) details.push(`${group.title}: ${names.join(', ')}`);
  }

  return {
    item,
    product,
    halfProduct,
    sizeLabel: size ? [size.name, size.detail].filter(Boolean).join(' · ') : undefined,
    details,
    unitCents,
    totalCents: unitCents * item.quantity,
  };
}

export interface CartTotals {
  itemCount: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  /** Quanto falta para a entrega grátis (centavos), se aplicável. */
  missingForFreeDeliveryCents: number | null;
  /** Quanto falta para o pedido mínimo (centavos). */
  missingForMinimumCents: number;
}

export function computeTotals(lines: ResolvedCartItem[], mode: FulfillmentMode): CartTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.item.quantity, 0);

  const { fee, freeFrom, minimumOrder } = siteConfig.delivery;
  const freeFromCents = freeFrom !== null ? toCents(freeFrom) : null;
  const qualifiesForFree = freeFromCents !== null && subtotalCents >= freeFromCents;

  const deliveryFeeCents = mode === 'delivery' && subtotalCents > 0 && !qualifiesForFree ? toCents(fee) : 0;

  return {
    itemCount,
    subtotalCents,
    deliveryFeeCents,
    totalCents: subtotalCents + deliveryFeeCents,
    missingForFreeDeliveryCents:
      freeFromCents !== null ? Math.max(0, freeFromCents - subtotalCents) : null,
    missingForMinimumCents: Math.max(0, toCents(minimumOrder) - subtotalCents),
  };
}

/** Chave que identifica itens idênticos (para somar quantidades em vez de duplicar linhas). */
export function selectionKey(selection: ItemSelection): string {
  const options = Object.keys(selection.options)
    .sort()
    .map((k) => `${k}:${[...(selection.options[k] ?? [])].sort().join(',')}`)
    .join('|');
  const half = selection.halfProductId
    ? [selection.productId, selection.halfProductId].sort().join('+')
    : selection.productId;
  return [half, selection.sizeId ?? '', options, (selection.notes ?? '').trim().toLowerCase()].join('#');
}
