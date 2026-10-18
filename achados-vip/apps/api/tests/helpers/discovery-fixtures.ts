/**
 * Apoio dos testes de descoberta/afiliados (SOMENTE testes): fonte roteirizada e fábricas de dados.
 * Nada daqui é usado em produção; os dados são fictícios por definição.
 */
import type { Category } from '@prisma/client';
import type { FetchContext, HealthResult, NormalizedListing, OfferSource } from '../../src/domain/types.js';
import { prisma } from '../../src/lib/db.js';

/** Fonte de teste cujo retorno é decidido pelo teste. */
export class ScriptedSource implements OfferSource {
  calls: FetchContext[] = [];
  constructor(
    private handler: (ctx: FetchContext) => NormalizedListing[] | Promise<NormalizedListing[]>,
    readonly name: string = 'scripted',
  ) {}
  async fetchListings(ctx: FetchContext): Promise<NormalizedListing[]> {
    this.calls.push(ctx);
    return this.handler(ctx);
  }
  async fetchListing(): Promise<NormalizedListing | null> {
    return null;
  }
  async healthCheck(): Promise<HealthResult> {
    return { ok: true, status: 'CONNECTED', detail: 'roteirizada (teste)' };
  }
}

export const T0 = new Date('2026-10-01T12:00:00.000Z');
export const hours = (n: number): number => n * 3_600_000;
export const at = (h: number): Date => new Date(T0.getTime() + hours(h));

/** Listagem "forte" (vendedor bom, estoque, vendidos, fotos): só o preço decide o score. */
export function mkListing(over: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    source: 'mercadolivre',
    externalId: 'MLB1000000001',
    catalogProductId: null,
    variationId: null,
    title: 'Fone Bluetooth JBL Tune 520BT Preto',
    permalink: 'https://produto.mercadolivre.com.br/MLB-1000000001-fone-bluetooth-jbl-tune-520bt-preto-_JM',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_1.jpg',
    imageUrl: null,
    mlCategoryId: 'MLB1055',
    condition: 'new',
    priceCents: 20000,
    advertisedOriginalPriceCents: null,
    availableQuantity: 30,
    soldQuantity: 800,
    seller: { id: '999', name: 'Loja Teste', reputationLevel: 'green', powerSellerStatus: 'platinum', positiveRatio: 0.99, completedTransactions: 8000 },
    coupon: null,
    installments: null,
    quality: { pictureCount: 6, hasWarranty: true, freeShipping: true, listingType: 'gold_special' },
    observedAt: T0,
    ...over,
  };
}

export async function seedCategory(over: Partial<Omit<Category, 'id'>> = {}): Promise<Category> {
  return prisma.category.create({
    data: { key: 'cat-teste', name: 'Categoria de teste', mlCategoryIds: ['MLB1055'], searchTerms: [], enabled: true, relevance: 80, ...over },
  });
}

/** Roda a descoberta `n` vezes com o mesmo preço, espaçadas de `stepHours` (histórico para a referência verificada). */
export async function seedProduct(over: Partial<{ source: string; externalId: string; title: string; categoryId: string | null; status: string }> = {}) {
  const externalId = over.externalId ?? 'MLB1000000001';
  return prisma.product.create({
    data: {
      source: over.source ?? 'mercadolivre',
      externalId,
      familyKey: `fam-${externalId}`,
      title: over.title ?? 'Produto de teste',
      permalink: `https://produto.mercadolivre.com.br/MLB-${externalId.replace(/\D/g, '')}-produto-de-teste-_JM`,
      categoryId: over.categoryId ?? null,
      status: over.status ?? 'ACTIVE',
    },
  });
}
