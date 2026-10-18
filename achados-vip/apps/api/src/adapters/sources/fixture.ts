/**
 * FixtureSource — listagens DETERMINÍSTICAS de TESTE (nunca são ofertas reais).
 * - source = 'fixture', título com prefixo "[FIXTURE]" e permalink em fixture.invalid (não abre nada real).
 * - Usada em dev/test quando settings.monitoring.source = 'fixture'. O painel deve rotular como "dados de TESTE".
 * - Permite injetar cenários por anúncio: queda de preço, desconto só anunciado, sem estoque, preço inconsistente.
 * Mesma entrada => mesmas listagens (ids, títulos e preços dependem só de categoria/termo/posição).
 */
import type { FetchContext, HealthResult, NormalizedListing, OfferSource } from '../../domain/types.js';

export const FIXTURE_SOURCE = 'fixture';
export const FIXTURE_TITLE_PREFIX = '[FIXTURE]';

export interface FixtureOptions {
  /** Relógio injetável (testes). */
  now?: () => Date;
  /** Itens gerados por categoria/termo quando ctx.limit permitir. Padrão 5. */
  itemsPerQuery?: number;
}

type Override = Partial<Omit<NormalizedListing, 'source' | 'externalId' | 'observedAt'>>;

/** FNV-1a 32 bits: hash simples e estável. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const KINDS = ['Fone Bluetooth', 'Carregador Turbo', 'Monitor Gamer', 'Air Fryer', 'Teclado Mecânico', 'Cafeteira', 'Mouse Sem Fio', 'Caixa de Som'];

export class FixtureSource implements OfferSource {
  readonly name = FIXTURE_SOURCE;
  private readonly now: () => Date;
  private readonly itemsPerQuery: number;
  private overrides = new Map<string, Override>();
  private known = new Map<string, NormalizedListing>();

  constructor(opts: FixtureOptions = {}) {
    this.now = opts.now ?? (() => new Date());
    this.itemsPerQuery = Math.max(1, opts.itemsPerQuery ?? 5);
  }

  // ----- cenários -----

  /** Aplica um patch arbitrário às listagens do anúncio. */
  override(externalId: string, patch: Override): this {
    this.overrides.set(externalId, { ...this.overrides.get(externalId), ...patch });
    return this;
  }
  /** Preço cai `pct`% em relação ao preço-base do fixture. */
  priceDrop(externalId: string, pct: number): this {
    const base = this.base(externalId);
    return this.override(externalId, { priceCents: Math.max(1, Math.round(base.priceCents * (1 - pct / 100))) });
  }
  /** Fonte informa "preço original" maior, mas SEM histórico que o confirme (desconto só anunciado). */
  advertisedOnly(externalId: string, originalPriceCents: number): this {
    return this.override(externalId, { advertisedOriginalPriceCents: originalPriceCents });
  }
  outOfStock(externalId: string): this {
    return this.override(externalId, { availableQuantity: 0 });
  }
  /** Preço cai para `factor` do base (ex.: 0.1 = queda de 90%, típico de dado inconsistente). */
  inconsistentPrice(externalId: string, factor = 0.1): this {
    const base = this.base(externalId);
    return this.override(externalId, { priceCents: Math.max(1, Math.round(base.priceCents * factor)) });
  }
  reset(): this {
    this.overrides.clear();
    return this;
  }

  // ----- OfferSource -----

  async fetchListings(ctx: FetchContext): Promise<NormalizedListing[]> {
    const keys = [...ctx.mlCategoryIds.map((c) => `cat:${c}`), ...ctx.searchTerms.map((t) => `q:${t}`)];
    if (keys.length === 0 || ctx.limit <= 0) return [];
    const perKey = Math.min(this.itemsPerQuery, Math.ceil(ctx.limit / keys.length));
    const out: NormalizedListing[] = [];
    for (const key of keys) {
      for (let i = 0; i < perKey && out.length < ctx.limit; i++) {
        const base = this.generate(key, i);
        this.known.set(base.externalId, base);
        out.push(this.apply(base));
      }
    }
    return out;
  }

  async fetchListing(externalId: string): Promise<NormalizedListing | null> {
    const base = this.known.get(externalId);
    return base ? this.apply(base) : null;
  }

  async healthCheck(): Promise<HealthResult> {
    return { ok: true, status: 'CONNECTED', detail: 'Fonte de TESTE (fixture): dados fictícios, não são ofertas reais.' };
  }

  // ----- geração -----

  private base(externalId: string): NormalizedListing {
    const l = this.known.get(externalId);
    if (!l) throw new Error(`fixture: anúncio ${externalId} ainda não foi gerado (chame fetchListings antes)`);
    return l;
  }

  private apply(base: NormalizedListing): NormalizedListing {
    const patch = this.overrides.get(base.externalId);
    return { ...base, ...patch, source: FIXTURE_SOURCE, externalId: base.externalId, observedAt: this.now() };
  }

  /** Listagem-base determinística para (chave de busca, posição). */
  private generate(key: string, index: number): NormalizedListing {
    const h = hash(`${key}#${index}`);
    const digits = String(9_000_000_000 + (h % 999_999_999)).padStart(10, '0');
    const externalId = `MLB${digits}`;
    const label = key.replace(/^(cat|q):/, '');
    const kind = KINDS[h % KINDS.length]!;
    const priceCents = (5000 + (h % 190_000)) - ((5000 + (h % 190_000)) % 100) + 90; // R$ xx,90
    return {
      source: FIXTURE_SOURCE,
      externalId,
      catalogProductId: null,
      variationId: null,
      title: `${FIXTURE_TITLE_PREFIX} ${kind} de teste ${label} ${index + 1}`,
      permalink: `https://fixture.invalid/MLB-${digits}`,
      thumbnail: null,
      imageUrl: null,
      mlCategoryId: key.startsWith('cat:') ? label : null,
      condition: 'new',
      priceCents,
      advertisedOriginalPriceCents: null,
      availableQuantity: 5 + (h % 95),
      soldQuantity: h % 2000,
      seller: { id: `fixture-seller-${h % 7}`, name: 'Vendedor de teste', reputationLevel: 'green', powerSellerStatus: 'gold', positiveRatio: 0.97, completedTransactions: 1000 + (h % 4000) },
      coupon: null,
      installments: null,
      quality: { pictureCount: 4, hasWarranty: true, freeShipping: true, listingType: 'gold_special' },
      observedAt: this.now(),
    };
  }
}
