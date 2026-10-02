import "server-only";
import { randomBytes, createHash } from "node:crypto";

/** Gera um token opaco e devolve o valor bruto (para enviar por e-mail /
 * cookie) junto com seu hash (o que de fato é salvo no banco). Nunca
 * guardamos o token em texto puro. */
export function generateToken() {
  const raw = randomBytes(32).toString("base64url");
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}
