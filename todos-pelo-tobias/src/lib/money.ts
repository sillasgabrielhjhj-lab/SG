const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 5000 -> "R$ 50,00" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

export interface AmountLimits {
  minCents: number;
  maxCents: number;
}

export type AmountError = "empty" | "negative" | "invalid" | "decimals" | "zero" | "min" | "max";

export type AmountResult = { ok: true; cents: number } | { ok: false; error: AmountError; message: string };

const fail = (error: AmountError, message: string): AmountResult => ({ ok: false, error, message });

/**
 * Converte o que a pessoa digitou ("25", "25,5", "25.50", "R$ 1.234,56") em centavos inteiros.
 * Aceita no máximo 2 casas decimais e, para não haver ambiguidade, só aceita ponto de milhar
 * em grupos de 3 dígitos ("1.234,56"). Rejeita vazio, negativo, zero, texto e valores fora do limite.
 */
export function parseAmountInput(raw: string, limits: AmountLimits): AmountResult {
  const text = raw.replace(/R\$|\s/gi, "");
  if (!text) return fail("empty", "Informe o valor que deseja doar.");
  if (text.startsWith("-")) return fail("negative", "O valor não pode ser negativo.");

  let intPart: string;
  let decPart: string;
  const thousands = /^([1-9]\d{0,2}(?:\.\d{3})+)(?:,(\d{0,2}))?$/.exec(text);
  const plain = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(text);
  if (thousands) {
    intPart = (thousands[1] ?? "").replaceAll(".", "");
    decPart = thousands[2] ?? "";
  } else if (plain) {
    intPart = plain[1] ?? "";
    decPart = plain[2] ?? "";
  } else if (/^\d+[.,]\d{3,}$/.test(text)) {
    return fail("decimals", "Use no máximo duas casas decimais, por exemplo 25,50.");
  } else {
    return fail("invalid", "Digite apenas números, por exemplo 25 ou 25,50.");
  }

  if (intPart.replace(/^0+/, "").length > 9) {
    return fail("max", `O valor máximo por QR Code é ${formatBRL(limits.maxCents)}.`);
  }
  const cents = parseInt(intPart, 10) * 100 + parseInt(decPart.padEnd(2, "0"), 10);

  if (cents === 0) return fail("zero", "Informe um valor maior que zero.");
  if (cents < limits.minCents) {
    return fail("min", `O valor mínimo é ${formatBRL(limits.minCents)}.`);
  }
  if (cents > limits.maxCents) {
    return fail("max", `O valor máximo por QR Code é ${formatBRL(limits.maxCents)}.`);
  }
  return { ok: true, cents };
}
