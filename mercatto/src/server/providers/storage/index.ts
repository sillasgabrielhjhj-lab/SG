import "server-only";
import { env } from "@/server/env";
import { LocalStorageProvider } from "@/server/providers/storage/local";
import { VercelBlobStorageProvider } from "@/server/providers/storage/vercel-blob";
import type { StorageProvider } from "@/server/providers/storage/types";

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  instance ??= env.STORAGE_PROVIDER === "vercel-blob" ? new VercelBlobStorageProvider(env.BLOB_READ_WRITE_TOKEN ?? "") : new LocalStorageProvider();
  return instance;
}
