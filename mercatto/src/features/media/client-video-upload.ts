"use client";

import { upload } from "@vercel/blob/client";
import { REVIEW_VIDEO, type ReviewVideoUploadMode } from "@/features/media/review-video";

type Result = { ok: true; url: string } | { ok: false; error: string };

/** Duração do vídeo (segundos) lida no navegador; NaN quando o formato não abre aqui. */
function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = window.setTimeout(() => done(Number.NaN), 5000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(video.duration);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done(Number.NaN);
    };
    video.src = url;
  });
}

/** Confere formato, tamanho e duração e envia o vídeo da avaliação. */
export async function uploadReviewVideo(file: File, mode: Exclude<ReviewVideoUploadMode, null>): Promise<Result> {
  if (!REVIEW_VIDEO.types.includes(file.type)) return { ok: false, error: "Formato não aceito. Envie um vídeo MP4, WebM ou MOV." };
  if (file.size > REVIEW_VIDEO.maxBytes) return { ok: false, error: "O vídeo pode ter até 50 MB." };
  const seconds = await videoDuration(file);
  if (seconds > REVIEW_VIDEO.maxSeconds + 0.5) return { ok: false, error: `O vídeo pode ter até ${REVIEW_VIDEO.maxSeconds} segundos.` };
  try {
    if (mode === "blob") {
      const name = file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-60) || "video";
      const blob = await upload(`${REVIEW_VIDEO.folder}${name}`, file, { access: "public", handleUploadUrl: REVIEW_VIDEO.endpoint, contentType: file.type });
      return { ok: true, url: blob.url };
    }
    const form = new FormData();
    form.set("file", file);
    const res = await fetch(REVIEW_VIDEO.endpoint, { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    return res.ok && data.url ? { ok: true, url: data.url } : { ok: false, error: data.error ?? "Não foi possível enviar o vídeo." };
  } catch {
    return { ok: false, error: "Não foi possível enviar o vídeo. Verifique a conexão e tente novamente." };
  }
}
