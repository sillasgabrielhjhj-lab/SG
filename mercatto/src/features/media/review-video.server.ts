import "server-only";
import { env } from "@/server/env";
import type { ReviewVideoUploadMode } from "@/features/media/review-video";

/**
 * Vídeos vão direto do navegador para o Vercel Blob (a Vercel recusa
 * requisições acima de 4,5 MB no servidor), o que exige o token de
 * leitura/escrita do Blob. Sem ele, o envio de vídeo fica oculto.
 */
export function reviewVideoUploadMode(): ReviewVideoUploadMode {
  if (env.STORAGE_PROVIDER === "local") return "local";
  return env.BLOB_READ_WRITE_TOKEN ? "blob" : null;
}
