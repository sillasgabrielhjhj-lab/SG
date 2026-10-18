import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import { env } from './env.js';

const IV_LEN = 12; // recomendado para GCM
const TAG_LEN = 16;

/**
 * AES-256-GCM. Formato do resultado: base64( iv(12) | tag(16) | ciphertext ).
 * Qualquer adulteração (iv, tag ou ciphertext) faz decryptJson lançar erro.
 */
export function encryptJson(value: unknown, key: Buffer = env.encryptionKey): string {
  if (key.length !== 32) throw new Error('chave de criptografia inválida');
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LEN });
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decryptJson<T = unknown>(encrypted: string, key: Buffer = env.encryptionKey): T {
  if (key.length !== 32) throw new Error('chave de criptografia inválida');
  const raw = Buffer.from(encrypted, 'base64');
  if (raw.length < IV_LEN + TAG_LEN) throw new Error('dados criptografados inválidos');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  try {
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(pt.toString('utf8')) as T;
  } catch {
    // mensagem genérica: não revela se foi chave errada ou adulteração
    throw new Error('falha ao descriptografar (dados adulterados ou chave incorreta)');
  }
}

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Token aleatório criptograficamente seguro (base64url, sem padding). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Comparação em tempo constante (não vaza tamanho: compara os SHA-256 de ambos). */
export function timingSafeEqual(a: string | Buffer, b: string | Buffer): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return nodeTimingSafeEqual(ha, hb);
}
export const safeEqual = timingSafeEqual;

/** HMAC-SHA256 (hex) de `payload` com `secret`. Usado para assinar webhooks. */
export function hmacSign(payload: string | Buffer, secret: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function hmacVerify(payload: string | Buffer, secret: string | Buffer, signature: string): boolean {
  return timingSafeEqual(hmacSign(payload, secret), signature);
}

/** Dica não sensível para identificar um segredo na UI: "••••abcd" (últimos 4 caracteres). */
export function secretHint(secret: string): string {
  const s = secret.trim();
  return s.length <= 8 ? '••••' : `••••${s.slice(-4)}`;
}
