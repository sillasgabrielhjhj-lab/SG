/** Junta classes condicionalmente (sem dependências externas). */
export function cn(...classes: Array<string | false | null | undefined | 0>): string {
  return classes.filter(Boolean).join(' ');
}

/** Gera um id curto e aleatório. */
export function uid(size = 8): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  const bytes =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? crypto.getRandomValues(new Uint8Array(size))
      : Array.from({ length: size }, () => Math.floor(Math.random() * 256));
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

/** Remove acentos e deixa minúsculo (para busca). */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
