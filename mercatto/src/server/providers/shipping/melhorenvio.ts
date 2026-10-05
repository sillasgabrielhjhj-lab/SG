import "server-only";
import { providerRequest } from "@/server/providers/http";
import { ProviderConfigurationError } from "@/server/providers/errors";
import { centsToDecimalNumber, decimalToCents } from "@/server/providers/decimal";
import type { ShippingOption, ShippingProvider, ShippingQuoteInput } from "@/server/providers/shipping/types";

/**
 * Melhor Envio — cotação real via API v2 (POST /api/v2/me/shipment/calculate).
 * Implementado conforme a documentação oficial; REQUER validação com token
 * real (sandbox: https://sandbox.melhorenvio.com.br) antes de produção.
 */
type MeService = { id: number; name: string; price?: string; custom_price?: string; delivery_time?: number; custom_delivery_range?: { min: number; max: number }; error?: string; company?: { name: string } };

export class MelhorEnvioShippingProvider implements ShippingProvider {
  readonly name = "melhorenvio";
  constructor(private readonly token: string, private readonly apiBase = "https://melhorenvio.com.br") {
    if (!token) throw new ProviderConfigurationError("melhorenvio", "SHIPPING_PROVIDER=melhorenvio requer MELHORENVIO_TOKEN.");
  }

  async quote(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    const { data } = await providerRequest<MeService[]>({
      provider: this.name,
      url: `${this.apiBase}/api/v2/me/shipment/calculate`,
      method: "POST",
      timeoutMs: 8000,
      userMessage: "Não foi possível calcular o frete agora. Tente novamente.",
      headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json", "User-Agent": "Mercatto (contato@mercatto.com.br)" },
      json: {
        from: { postal_code: input.originCep },
        to: { postal_code: input.destinationCep },
        products: input.items.map((item, i) => ({
          id: String(i + 1),
          width: item.widthCm,
          height: item.heightCm,
          length: item.lengthCm,
          weight: item.weightGrams / 1000,
          insurance_value: centsToDecimalNumber(item.unitPriceCents),
          quantity: item.quantity,
        })),
      },
    });
    return (Array.isArray(data) ? data : [])
      .filter((s) => !s.error && (s.custom_price ?? s.price))
      .map((s) => {
        const price = decimalToCents(s.custom_price ?? s.price ?? null) ?? 0;
        return {
          id: `melhorenvio:${s.id}`,
          service: s.name,
          carrier: s.company?.name ?? null,
          priceCents: input.freeShipping ? 0 : price,
          originalPriceCents: price,
          minDays: s.custom_delivery_range?.min ?? s.delivery_time ?? 0,
          maxDays: s.custom_delivery_range?.max ?? s.delivery_time ?? 0,
          isPickup: false,
        };
      })
      .sort((a, b) => a.priceCents - b.priceCents);
  }
}
