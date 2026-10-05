/**
 * Números de pedido legíveis: "MRC-7KQ2-9XW4".
 * Alfabeto base32 sem caracteres ambíguos (sem 0/O, 1/I/L e U), fácil de
 * ditar ao atendimento. 30^8 ≈ 6,5 × 10^11 combinações; a unicidade é
 * garantida pelo índice único no banco (colisão => nova tentativa).
 */
export const ORDER_NUMBER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ORDER_NUMBER_PREFIX = "MRC";
const BODY_LENGTH = 8;

export function generateOrderNumber(random: (bytes: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b)): string {
  const chars: string[] = [];
  const max = 256 - (256 % ORDER_NUMBER_ALPHABET.length); // evita viés de módulo
  while (chars.length < BODY_LENGTH) {
    const bytes = random(new Uint8Array(BODY_LENGTH * 2));
    for (const byte of bytes) {
      if (byte >= max) continue;
      chars.push(ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length]!);
      if (chars.length === BODY_LENGTH) break;
    }
  }
  return `${ORDER_NUMBER_PREFIX}-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

const ORDER_NUMBER_RE = new RegExp(`^${ORDER_NUMBER_PREFIX}-[${ORDER_NUMBER_ALPHABET}]{4}-[${ORDER_NUMBER_ALPHABET}]{4}$`);

/** Normaliza entrada do usuário (minúsculas, espaços, sem hífens) e valida o formato. */
export function normalizeOrderNumber(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const body = compact.startsWith(ORDER_NUMBER_PREFIX) ? compact.slice(ORDER_NUMBER_PREFIX.length) : compact;
  if (body.length !== BODY_LENGTH) return null;
  const candidate = `${ORDER_NUMBER_PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;
  return ORDER_NUMBER_RE.test(candidate) ? candidate : null;
}
