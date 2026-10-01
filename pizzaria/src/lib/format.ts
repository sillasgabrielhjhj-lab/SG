import { siteConfig } from '@/config/site';

const currencyFormatter = new Intl.NumberFormat(siteConfig.locale, {
  style: 'currency',
  currency: siteConfig.currency,
});

/** Converte reais (ex.: 54.9) para centavos inteiros (5490), evitando erros de ponto flutuante. */
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

/** Formata centavos como moeda: 5490 → "R$ 54,90". */
export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/** Formata reais como moeda: 54.9 → "R$ 54,90". */
export function formatPrice(reais: number): string {
  return formatCents(toCents(reais));
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Máscara de telefone brasileiro: (11) 98765-4321 ou (11) 3456-7890. */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara de CEP: 01310-100. */
export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Máscara de dinheiro digitado livremente: "50" → "50", "50,5" → "50,5". */
export function parseMoneyInput(value: string): number | null {
  const cleaned = value.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "item" / "items" */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
