/**
 * Contrato de cotação de frete. Desacoplado de transportadora.
 *  - "table": tabela própria configurável (ShippingRule) por loja/região/peso.
 *  - "melhorenvio": integração futura (ver README).
 */
export type ShippingPackageItem = {
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  quantity: number;
  unitPriceCents: number;
};

export type ShippingQuoteInput = {
  originCep: string;
  destinationCep: string;
  /** UF de origem/destino quando conhecidas (melhora a regra de região). */
  originState?: string | null;
  destinationState?: string | null;
  storeId: string;
  items: ShippingPackageItem[];
  /** Frete grátis aplicável (produto/campanha) — o provedor retorna preço 0. */
  freeShipping?: boolean;
};

export type ShippingOption = {
  id: string; // ex.: "table:standard"
  service: string; // "Padrão", "Expresso", "Retirada"
  carrier: string | null;
  priceCents: number;
  originalPriceCents: number; // antes de frete grátis
  minDays: number;
  maxDays: number;
  isPickup: boolean;
};

export interface ShippingProvider {
  readonly name: string;
  quote(input: ShippingQuoteInput): Promise<ShippingOption[]>;
}
