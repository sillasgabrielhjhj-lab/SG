import { onlyDigits } from "@/lib/format";

/** Valida EAN-8/UPC-A(12)/EAN-13/GTIN-14 pelo dígito verificador (módulo 10). */
export function isValidGtin(value: string): boolean {
  const d = onlyDigits(value);
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const digits = d.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
