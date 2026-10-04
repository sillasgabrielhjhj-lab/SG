/**
 * Dinheiro na Mercatto é SEMPRE representado em centavos inteiros (number
 * inteiro seguro). Nunca faça aritmética monetária com reais em ponto flutuante.
 */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function assertCents(value: number, label = "valor"): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} monetário inválido (esperado inteiro em centavos): ${value}`);
  }
  return value;
}

/** 129990 -> "R$ 1.299,90" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

/** Divide em partes inteiras e centavos para exibição tipográfica de preço. */
export function splitBRL(cents: number): { integer: string; decimal: string } {
  const abs = Math.abs(cents);
  const integer = Math.floor(abs / 100).toLocaleString("pt-BR");
  const decimal = String(abs % 100).padStart(2, "0");
  return { integer: cents < 0 ? `-${integer}` : integer, decimal };
}

/**
 * Converte entrada humana ("1.299,90", "1299.9", "R$ 10") em centavos.
 * Retorna null se inválido. Usado em formulários (validação final no servidor).
 */
export function parseBRL(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  let s = input.replace(/[R$\s]/g, "").trim();
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const [intPart, decPart = ""] = s.split(".");
  const negative = intPart!.startsWith("-");
  const cents = Math.abs(Number(intPart)) * 100 + Number(decPart.padEnd(2, "0"));
  return negative ? -cents : cents;
}

/** Centavos -> string para input de formulário ("1299,90"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Aplica percentual inteiro (0-100) arredondando para o centavo mais próximo. */
export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

/** Aplica basis points (1% = 100 bps). */
export function bpsOf(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}

/** Percentual de desconto inteiro entre preço "de" e "por". */
export function discountPercent(fromCents: number, toCents: number): number {
  if (fromCents <= 0 || toCents >= fromCents) return 0;
  return Math.floor(((fromCents - toCents) / fromCents) * 100);
}

/**
 * Distribui um valor (ex.: desconto de cupom) proporcionalmente entre partes,
 * garantindo que a soma final seja exatamente igual ao total (sem perder centavos).
 */
export function allocateProportionally(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || totalCents === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (totalCents * w) / sum);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = totalCents - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i]! += 1;
    remainder -= 1;
  }
  return floored;
}

export type InstallmentOption = {
  count: number;
  installmentCents: number;
  totalCents: number;
  interestFree: boolean;
};

export type InstallmentConfig = {
  maxInstallments: number;
  interestFreeInstallments: number;
  monthlyInterestBps: number;
  minInstallmentCents: number;
};

export const DEFAULT_INSTALLMENT_CONFIG: InstallmentConfig = {
  maxInstallments: 12,
  interestFreeInstallments: 10,
  monthlyInterestBps: 199,
  minInstallmentCents: 500,
};

/**
 * Calcula opções de parcelamento. Parcelas sem juros dividem o total; acima do
 * limite sem juros aplica-se a Tabela Price com a taxa mensal configurada.
 * A última parcela absorve o arredondamento para que a soma feche o total.
 */
export function installmentOptions(
  totalCents: number,
  config: InstallmentConfig = DEFAULT_INSTALLMENT_CONFIG,
): InstallmentOption[] {
  const options: InstallmentOption[] = [];
  for (let n = 1; n <= config.maxInstallments; n++) {
    const interestFree = n <= config.interestFreeInstallments || config.monthlyInterestBps === 0;
    let installmentCents: number;
    let total: number;
    if (interestFree) {
      installmentCents = Math.ceil(totalCents / n);
      total = totalCents;
    } else {
      const i = config.monthlyInterestBps / 10_000;
      const factor = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
      installmentCents = Math.ceil(totalCents * factor);
      total = installmentCents * n;
    }
    if (n > 1 && installmentCents < config.minInstallmentCents) break;
    options.push({ count: n, installmentCents, totalCents: total, interestFree });
  }
  return options;
}

/** Melhor parcelamento sem juros para exibir em cards ("em até 10x de R$ 99,90 sem juros"). */
export function bestInterestFreeInstallment(
  totalCents: number,
  config: InstallmentConfig = DEFAULT_INSTALLMENT_CONFIG,
): InstallmentOption | null {
  const free = installmentOptions(totalCents, config).filter((o) => o.interestFree && o.count > 1);
  return free.at(-1) ?? null;
}
