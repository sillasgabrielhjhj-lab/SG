/**
 * Conversões entre centavos inteiros (padrão interno) e valores decimais em
 * reais exigidos por APIs externas (ex.: `transaction_amount: 129.9`).
 * Implementadas por manipulação de string — sem aritmética de ponto flutuante.
 */

/** 12990 -> "129.90"; -5 -> "-0.05". Lança se não for inteiro seguro. */
export function centsToDecimalString(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Valor monetário inválido (esperado inteiro em centavos): ${cents}`);
  }
  const negative = cents < 0;
  const digits = String(Math.abs(cents)).padStart(3, "0");
  const integer = digits.slice(0, -2);
  const fraction = digits.slice(-2);
  return `${negative ? "-" : ""}${integer}.${fraction}`;
}

/**
 * 12990 -> 129.9 (number). O número é obtido a partir da string decimal exata,
 * logo serializa em JSON exatamente como "129.9".
 */
export function centsToDecimalNumber(cents: number): number {
  return Number(centsToDecimalString(cents));
}

/**
 * Valor decimal em reais (number ou string, ex.: 129.9, "129.90", "1299")
 * -> centavos inteiros. Aceita no máximo 2 casas decimais significativas
 * (números com mais casas são arredondados na 2ª casa via toFixed).
 * Retorna null para entradas inválidas.
 */
export function decimalToCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    text = value.toFixed(2);
  } else {
    text = value.trim();
  }
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const [, sign, integer = "0", fraction = ""] = match;
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return sign === "-" && cents !== 0 ? -cents : cents;
}
