/** Regras do vídeo da avaliação (compartilhadas entre navegador e servidor). */
export const REVIEW_VIDEO = {
  maxBytes: 50 * 1024 * 1024,
  maxSeconds: 60,
  types: ["video/mp4", "video/webm", "video/quicktime"] as string[],
  folder: "reviews/videos/",
  endpoint: "/api/uploads/review-video",
};

/** Como o navegador envia o vídeo: direto ao Vercel Blob, ao servidor local (dev) ou indisponível. */
export type ReviewVideoUploadMode = "blob" | "local" | null;
