import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isProduction } from "@/server/env";
import { ProviderConfigurationError } from "@/server/providers/errors";
import type { StorageProvider } from "@/server/providers/storage/types";

const ROOT = path.join(process.cwd(), "public", "uploads");

/** Valida a chave contra path traversal: apenas segmentos [a-z0-9-_.] relativos. */
export function safeKey(key: string): string {
  if (!/^[a-z0-9][a-z0-9/_.-]{0,200}$/i.test(key) || key.includes("..") || key.startsWith("/")) {
    throw new Error("Chave de armazenamento inválida.");
  }
  return key;
}

/** Armazenamento LOCAL — somente desenvolvimento (o filesystem da Vercel é somente leitura). */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  constructor() {
    if (isProduction && !process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION) {
      throw new ProviderConfigurationError("local", "STORAGE_PROVIDER=local não funciona em produção (Vercel). Use STORAGE_PROVIDER=vercel-blob.");
    }
  }

  async put(key: string, data: Buffer, contentType: string) {
    const k = safeKey(key);
    const file = path.join(ROOT, k);
    if (!file.startsWith(ROOT + path.sep)) throw new Error("Chave de armazenamento inválida.");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return { url: `/uploads/${k}`, key: k, size: data.length, contentType };
  }

  async delete(key: string) {
    const file = path.join(ROOT, safeKey(key));
    if (!file.startsWith(ROOT + path.sep)) return;
    await unlink(file).catch(() => undefined);
  }
}
