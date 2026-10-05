"use client";

import { uploadImagesAction } from "@/features/media/actions";

/**
 * Envio de imagens pelo navegador:
 *  - fotos grandes (comuns em celulares) são reduzidas para no máximo 2400 px e
 *    recomprimidas em JPEG antes do envio — a Vercel recusa requisições acima
 *    de 4,5 MB, e o servidor ainda gera a versão final (WebP, sem EXIF);
 *  - formatos que o navegador consegue abrir mas o servidor não aceita (ex.:
 *    HEIC no Safari) são convertidos para JPEG;
 *  - um arquivo por requisição, para nenhum envio passar do limite.
 * A validação real continua no servidor (tipo, dimensões, re-encode).
 */

const MAX_SIDE = 2400;
const QUALITY = 0.88;
const PASSTHROUGH_BYTES = 1.5 * 1024 * 1024;
const SERVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const SERVER_EXT = /\.(jpe?g|png|webp|avif)$/i;

export async function prepareImage(file: File): Promise<File> {
  const accepted = SERVER_TYPES.has(file.type) && SERVER_EXT.test(file.name);
  if (accepted && file.size <= PASSTHROUGH_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff"; // PNG transparente vira fundo branco (não preto) no JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "foto";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    // Navegador não abre o formato: envia como está e o servidor explica o motivo.
    return file;
  }
}

type ActionResult = Awaited<ReturnType<typeof uploadImagesAction>>;
type UploadedFile = Extract<ActionResult, { ok: true }>["data"]["files"][number];
export type UploadImagesResult = { ok: true; data: { files: UploadedFile[] } } | { ok: false; error: string };

export async function uploadImages(files: File[], folder: string): Promise<UploadImagesResult> {
  const results: UploadedFile[] = [];
  for (const original of files) {
    const file = await prepareImage(original);
    const form = new FormData();
    form.set("folder", folder);
    form.append("files", file);
    try {
      const res = await uploadImagesAction(form);
      if (!res.ok) {
        // Erro geral (permissão, limite de envios): interrompe se nada foi enviado.
        if (results.length === 0) return { ok: false, error: res.error };
        results.push({ ok: false, name: original.name, error: res.error });
        break;
      }
      results.push(...res.data.files.map((f) => ({ ...f, name: original.name })));
    } catch {
      results.push({ ok: false, name: original.name, error: "Falha no envio. Verifique sua conexão e tente novamente." });
    }
  }
  return { ok: true, data: { files: results } };
}
