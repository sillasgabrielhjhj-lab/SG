import { normalizeText } from "@/lib/utils";

/**
 * Amostras visuais (aproximadas) das cores oficiais, usadas apenas no seletor
 * de "Cor" da página do produto. Cor sem amostra cadastrada aparece só com o nome.
 */
const SWATCHES: Record<string, string> = {};

export function registerSwatches(entries: Record<string, string>) {
  for (const [name, hex] of Object.entries(entries)) SWATCHES[normalizeText(name)] = hex;
}

export function swatchFor(colorName: string): string | null {
  return SWATCHES[normalizeText(colorName)] ?? null;
}
