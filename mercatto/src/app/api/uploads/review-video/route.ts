import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { env } from "@/server/env";
import { getCurrentUser } from "@/server/auth/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { isAppError } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { getStorageProvider } from "@/server/providers/storage";
import { REVIEW_VIDEO } from "@/features/media/review-video";
import { reviewVideoUploadMode } from "@/features/media/review-video.server";

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });
const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

/**
 * Envio do vídeo da avaliação (cliente logado).
 *  - Vercel Blob: emite um token de upload restrito (pasta, tipos e tamanho)
 *    e o navegador envia o arquivo direto ao Blob.
 *  - Local (desenvolvimento): recebe o arquivo e grava em public/uploads.
 * A avaliação só aceita URLs desta pasta (validação no servidor).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Entre na sua conta para enviar o vídeo.", 401);
  try {
    await enforceRateLimit(`review-video:${user.id}`, 10, 60 * 60);
  } catch (error) {
    return fail(isAppError(error) ? error.message : "Muitas tentativas. Tente mais tarde.", 429);
  }
  const mode = reviewVideoUploadMode();
  if (!mode) return fail("Envio de vídeos indisponível no momento.", 503);

  if (mode === "local") {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail("Arquivo não recebido.", 400);
    if (!REVIEW_VIDEO.types.includes(file.type)) return fail("Formato não aceito. Envie MP4, WebM ou MOV.", 415);
    if (file.size > REVIEW_VIDEO.maxBytes) return fail("O vídeo pode ter até 50 MB.", 413);
    const key = `${REVIEW_VIDEO.folder}${user.id}-${Date.now()}.${EXT[file.type]}`;
    const stored = await getStorageProvider().put(key, Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ url: stored.url });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      token: env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(REVIEW_VIDEO.folder) || pathname.includes("..")) throw new Error("Destino inválido.");
        return { allowedContentTypes: REVIEW_VIDEO.types, maximumSizeInBytes: REVIEW_VIDEO.maxBytes, addRandomSuffix: true, tokenPayload: user.id };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.warn("uploads.review_video.failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Não foi possível preparar o envio do vídeo.", 400);
  }
}
