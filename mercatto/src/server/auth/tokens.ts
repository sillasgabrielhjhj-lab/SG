import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Token aleatório de alta entropia (base64url, 256 bits). */
export const generateToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Apenas o hash do token é persistido — vazamento do banco não expõe sessões. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
