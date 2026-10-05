import "server-only";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { regionOfUf } from "@/lib/validators/br";
import { ufFromCep } from "@/lib/cep-ranges";
import type { ShippingOption, ShippingProvider, ShippingQuoteInput } from "@/server/providers/shipping/types";

type Rule = { name: string; regionCode: string; maxWeightGrams: number; priceCents: number; additionalKgCents: number; minDays: number; maxDays: number };

/** Peso tarifável: maior entre peso real e cúbico (C×L×A/6000 kg), somado por unidade. */
export function chargeableWeightGrams(items: ShippingQuoteInput["items"]): number {
  return items.reduce((sum, i) => {
    const cubicGrams = Math.ceil(((i.lengthCm * i.widthCm * i.heightCm) / 6000) * 1000);
    return sum + Math.max(i.weightGrams, cubicGrams) * i.quantity;
  }, 0);
}

/** Região da regra: UF exata > mesma UF > mesma região > demais. */
export function matchRegionCodes(originUf: string | null, destUf: string | null): string[] {
  const codes: string[] = [];
  if (destUf) codes.push(destUf);
  if (originUf && destUf && originUf === destUf) codes.push("SAME_STATE");
  else if (originUf && destUf && regionOfUf(originUf) === regionOfUf(destUf)) codes.push("SAME_REGION");
  codes.push("OTHER");
  return codes;
}

/** Calcula o preço de um serviço para o peso, usando a menor faixa que comporta o peso (ou a maior + adicional/kg). */
export function priceForWeight(rules: Rule[], weightGrams: number): { priceCents: number; minDays: number; maxDays: number } | null {
  if (!rules.length) return null;
  const sorted = [...rules].sort((a, b) => a.maxWeightGrams - b.maxWeightGrams);
  const fit = sorted.find((r) => r.maxWeightGrams >= weightGrams);
  if (fit) return { priceCents: fit.priceCents, minDays: fit.minDays, maxDays: fit.maxDays };
  const largest = sorted[sorted.length - 1]!;
  const extraKg = Math.ceil((weightGrams - largest.maxWeightGrams) / 1000);
  return { priceCents: largest.priceCents + extraKg * largest.additionalKgCents, minDays: largest.minDays, maxDays: largest.maxDays };
}

export function quoteFromRules(rules: Rule[], input: ShippingQuoteInput): ShippingOption[] {
  const originUf = input.originState ?? ufFromCep(input.originCep);
  const destUf = input.destinationState ?? ufFromCep(input.destinationCep);
  const weight = chargeableWeightGrams(input.items);
  const codes = matchRegionCodes(originUf, destUf);
  const byService = new Map<string, Rule[]>();
  for (const r of rules) byService.set(r.name, [...(byService.get(r.name) ?? []), r]);

  const options: ShippingOption[] = [];
  for (const [service, serviceRules] of byService) {
    if (serviceRules.some((r) => r.regionCode === "PICKUP")) {
      if (originUf && destUf && originUf === destUf) {
        options.push({ id: `table:${service}`, service, carrier: null, priceCents: 0, originalPriceCents: 0, minDays: serviceRules[0]!.minDays, maxDays: serviceRules[0]!.maxDays, isPickup: true });
      }
      continue;
    }
    const code = codes.find((c) => serviceRules.some((r) => r.regionCode === c));
    if (!code) continue;
    const price = priceForWeight(serviceRules.filter((r) => r.regionCode === code), weight);
    if (!price) continue;
    options.push({
      id: `table:${service}`,
      service,
      carrier: "Transportadora parceira",
      priceCents: input.freeShipping ? 0 : price.priceCents,
      originalPriceCents: price.priceCents,
      minDays: price.minDays,
      maxDays: price.maxDays,
      isPickup: false,
    });
  }
  return options.sort((a, b) => a.priceCents - b.priceCents || a.maxDays - b.maxDays);
}

/** Frete por tabela própria (ShippingRule): regras da loja, com fallback nas regras globais. */
export class TableShippingProvider implements ShippingProvider {
  readonly name = "table";

  async quote(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    const select = { name: true, regionCode: true, maxWeightGrams: true, priceCents: true, additionalKgCents: true, minDays: true, maxDays: true } as const;
    let rules = await db.shippingRule.findMany({ where: { storeId: input.storeId, isActive: true }, select });
    if (!rules.length) rules = await db.shippingRule.findMany({ where: { storeId: null, isActive: true }, select });
    const options = quoteFromRules(rules, input);
    if (!options.length) throw new AppError("UNPROCESSABLE", "Não entregamos neste CEP para este vendedor no momento.");
    return options;
  }
}
