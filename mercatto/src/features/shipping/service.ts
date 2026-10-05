import "server-only";
import { AppError } from "@/server/errors";
import { getShippingProvider } from "@/server/providers/shipping";
import type { ShippingOption } from "@/server/providers/shipping/types";
import { ufFromCep } from "@/lib/cep-ranges";
import { groupByStore, priceLines, type PricedLine } from "@/features/cart/pricing.server";
import { getStoreSettings } from "@/features/settings/queries";

export type StoreShippingQuote = {
  storeId: string;
  storeName: string;
  isOfficial: boolean;
  subtotalCents: number;
  freeShippingReason: "PRODUCT" | "THRESHOLD" | null;
  options: ShippingOption[];
  error: string | null;
};

/**
 * Cota o frete de um conjunto de linhas, por loja (cada loja envia de sua
 * origem). Produtos com frete grátis não entram no peso cobrado; a loja
 * oficial dá frete grátis acima do limite configurado.
 */
export async function quoteForLines(lines: PricedLine[], destinationCep: string, destinationState?: string | null): Promise<StoreShippingQuote[]> {
  const settings = await getStoreSettings();
  const provider = getShippingProvider();
  const quotes: StoreShippingQuote[] = [];
  for (const [storeId, storeLines] of groupByStore(lines)) {
    const store = storeLines[0]!.store;
    const subtotal = storeLines.reduce((s, l) => s + l.lineTotalCents, 0);
    const thresholdReached = store.isOfficial && settings.freeShippingThresholdCents !== null && subtotal >= settings.freeShippingThresholdCents;
    const chargeable = thresholdReached ? [] : storeLines.filter((l) => !l.freeShipping);
    const freeShipping = chargeable.length === 0;
    const items = (freeShipping ? storeLines : chargeable).map((l) => ({
      weightGrams: l.weightGrams,
      heightCm: l.heightCm,
      widthCm: l.widthCm,
      lengthCm: l.lengthCm,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
    }));
    try {
      const options = await provider.quote({
        originCep: store.originCep,
        destinationCep,
        originState: store.originState ?? ufFromCep(store.originCep),
        destinationState: destinationState ?? ufFromCep(destinationCep),
        storeId,
        items,
        freeShipping,
      });
      quotes.push({
        storeId,
        storeName: store.name,
        isOfficial: store.isOfficial,
        subtotalCents: subtotal,
        freeShippingReason: thresholdReached ? "THRESHOLD" : freeShipping ? "PRODUCT" : null,
        options,
        error: options.length ? null : "Entrega indisponível para este CEP.",
      });
    } catch (error) {
      quotes.push({
        storeId,
        storeName: store.name,
        isOfficial: store.isOfficial,
        subtotalCents: subtotal,
        freeShippingReason: null,
        options: [],
        error: error instanceof AppError ? error.message : "Não foi possível calcular o frete agora.",
      });
    }
  }
  return quotes;
}

/** Simulação na página do produto. */
export async function quoteForProduct(variantId: string, quantity: number, destinationCep: string) {
  const [line] = await priceLines([{ variantId, quantity }]);
  if (!line || line.availability === "UNAVAILABLE") throw new AppError("NOT_FOUND", "Produto indisponível.");
  const [quote] = await quoteForLines([line], destinationCep);
  return quote!;
}
