import "server-only";
import { del, put } from "@vercel/blob";
import { ProviderConfigurationError } from "@/server/providers/errors";
import type { StorageProvider } from "@/server/providers/storage/types";

/** Vercel Blob (CDN). O token é criado ao conectar um Blob Store ao projeto na Vercel. */
export class VercelBlobStorageProvider implements StorageProvider {
  readonly name = "vercel-blob";
  constructor(private readonly token: string) {
    if (!token) throw new ProviderConfigurationError("vercel-blob", "STORAGE_PROVIDER=vercel-blob requer BLOB_READ_WRITE_TOKEN.");
  }

  async put(key: string, data: Buffer, contentType: string) {
    const blob = await put(key, data, { access: "public", contentType, token: this.token, addRandomSuffix: true, cacheControlMaxAge: 31536000 });
    // A URL pública é a "chave" para remoção no Blob.
    return { url: blob.url, key: blob.url, size: data.length, contentType };
  }

  async delete(key: string) {
    await del(key, { token: this.token });
  }
}
