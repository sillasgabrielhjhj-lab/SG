import "server-only";
import { del, put } from "@vercel/blob";
import { ProviderConfigurationError } from "@/server/providers/errors";
import type { StorageProvider } from "@/server/providers/storage/types";

/**
 * Vercel Blob (CDN). Credenciais criadas ao conectar um Blob Store ao projeto:
 *  - BLOB_READ_WRITE_TOKEN (token de leitura/escrita), ou
 *  - BLOB_STORE_ID + OIDC da própria Vercel (conexões novas, sem token) — o SDK
 *    obtém o token OIDC da requisição automaticamente.
 * O Blob Store precisa ser PÚBLICO: as fotos são exibidas na loja por URL.
 */
export class VercelBlobStorageProvider implements StorageProvider {
  readonly name = "vercel-blob";
  private readonly auth: { token?: string };

  constructor(token: string | null | undefined, storeId: string | null | undefined) {
    const rw = token?.trim();
    if (!rw && !storeId?.trim()) {
      throw new ProviderConfigurationError("vercel-blob", "STORAGE_PROVIDER=vercel-blob requer um Blob Store conectado ao projeto (BLOB_READ_WRITE_TOKEN ou BLOB_STORE_ID).");
    }
    this.auth = rw ? { token: rw } : {};
  }

  async put(key: string, data: Buffer, contentType: string) {
    const blob = await put(key, data, { access: "public", contentType, ...this.auth, addRandomSuffix: true, cacheControlMaxAge: 31536000 });
    // A URL pública é a "chave" para remoção no Blob.
    return { url: blob.url, key: blob.url, size: data.length, contentType };
  }

  async delete(key: string) {
    await del(key, this.auth);
  }
}
