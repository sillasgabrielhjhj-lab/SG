import { Badge } from '@/components/ui/badge';
import { formatBRL } from '@/lib/format';
import type { OfferDTO } from '@/lib/types';

/**
 * Selo de desconto honesto:
 * - verificado: referência confirmada pelo histórico próprio ⇒ pode exibir "de/por" e %;
 * - apenas anunciado: a fonte informou um preço original, mas não foi verificado ⇒ SEM percentual;
 * - sem desconto verificado: nada a afirmar.
 */
export function DiscountSeal({ offer, advertisedOriginalCents }: { offer: Pick<OfferDTO, 'discountVerified' | 'originalPriceCents' | 'priceCents'>; advertisedOriginalCents?: number | null }) {
  if (offer.discountVerified) {
    return (
      <Badge tone="success" title="A referência de preço foi confirmada pelo histórico próprio (ou fonte oficial).">
        Desconto verificado
      </Badge>
    );
  }
  const advertised = advertisedOriginalCents ?? offer.originalPriceCents;
  if (advertised != null && advertised > offer.priceCents) {
    return (
      <Badge tone="warning" title="A fonte informou um preço original, mas ele não foi verificado. Não é usado como 'de/por' nas mensagens.">
        Desconto apenas anunciado
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" title="Sem referência de preço verificada. A mensagem mostra só o preço atual.">
      Sem desconto verificado
    </Badge>
  );
}

/** Preço atual + (se verificado) preço de referência riscado e percentual. */
export function PriceCell({ offer, align = 'left' }: { offer: OfferDTO; align?: 'left' | 'right' }) {
  const verified = offer.discountVerified && offer.originalPriceCents != null && offer.originalPriceCents > offer.priceCents;
  return (
    <div className={align === 'right' ? 'text-right' : undefined}>
      <p className="text-sm font-semibold tabular-nums">{formatBRL(offer.priceCents)}</p>
      {verified ? (
        <p className="text-xs text-muted">
          <s className="tabular-nums">{formatBRL(offer.originalPriceCents)}</s>
          {offer.discountPct != null ? <span className="ml-1.5 font-medium text-success-ink">-{offer.discountPct}%</span> : null}
        </p>
      ) : null}
      <div className="mt-1">
        <DiscountSeal offer={offer} />
      </div>
    </div>
  );
}
