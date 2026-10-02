export type ShippingOption = {
  id: "standard" | "express";
  label: string;
  days: number;
  costCents: number;
};

/** Estimativa ilustrativa baseada no CEP — não há integração real com
 * transportadora. Mesma lógica usada na página de produto, aqui aplicada
 * ao total do carrinho para gerar as opções do checkout. */
export function getShippingOptions(zipCode: string): ShippingOption[] {
  const digits = zipCode.replace(/\D/g, "");
  let hash = 0;
  for (const char of digits) hash = (hash * 31 + Number(char)) >>> 0;

  const standardDays = 3 + (hash % 6);
  const isFree = hash % 4 === 0;
  const standardCost = isFree ? 0 : 990 + (hash % 20) * 100;

  return [
    {
      id: "standard",
      label: "Entrega padrão",
      days: standardDays,
      costCents: standardCost,
    },
    {
      id: "express",
      label: "Entrega expressa",
      days: Math.max(1, Math.round(standardDays / 2)),
      costCents: standardCost + 1990,
    },
  ];
}
