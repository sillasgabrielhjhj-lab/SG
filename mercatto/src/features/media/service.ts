import "server-only";
import { randomBytes } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { AppError } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { getStorageProvider } from "@/server/providers/storage";

export const UPLOAD_FOLDERS = ["products", "stores", "banners", "reviews", "categories", "brands"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);
const ALLOWED_EXT = /\.(jpe?g|png|webp|avif)$/i;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MIN_SIDE = 300;
const MAX_SIDE = 8000;
const OUTPUT_MAX_SIDE = 1600;

export type ProcessedImage = { url: string; key: string; width: number; height: number; size: number };

/**
 * Valida (tipo REAL via decodificação, extensão, MIME declarado, tamanho e
 * dimensões), remove metadados (EXIF/GPS), redimensiona e converte para WebP.
 * SVG/HTML/GIF são recusados (vetores de XSS e animações pesadas).
 */
export async function processImageUpload(
  buffer: Buffer,
  opts: { originalName: string; declaredType: string; folder: UploadFolder },
): Promise<ProcessedImage> {
  if (buffer.length === 0) throw new AppError("VALIDATION", "Arquivo vazio.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION", "Imagem acima de 8 MB.");
  if (!ALLOWED_EXT.test(opts.originalName)) throw new AppError("VALIDATION", "Formato não permitido. Use JPG, PNG, WebP ou AVIF.");
  if (!ALLOWED_MIME.has(opts.declaredType)) throw new AppError("VALIDATION", "Tipo de arquivo não permitido.");

  let meta: Metadata;
  try {
    meta = await sharp(buffer, { failOn: "error", limitInputPixels: MAX_SIDE * MAX_SIDE }).metadata();
  } catch {
    throw new AppError("VALIDATION", "Arquivo não é uma imagem válida.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new AppError("VALIDATION", "Conteúdo do arquivo não é uma imagem permitida.");
  if ((meta.pages ?? 1) > 1) throw new AppError("VALIDATION", "Imagens animadas não são permitidas.");
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < MIN_SIDE || height < MIN_SIDE) throw new AppError("VALIDATION", `A imagem deve ter pelo menos ${MIN_SIDE}×${MIN_SIDE} px.`);
  if (width > MAX_SIDE || height > MAX_SIDE) throw new AppError("VALIDATION", `A imagem deve ter no máximo ${MAX_SIDE}×${MAX_SIDE} px.`);

  const { data, info } = await sharp(buffer)
    .rotate() // aplica a orientação EXIF e descarta metadados
    .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const now = new Date();
  const key = `${opts.folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(12).toString("hex")}.webp`;
  const stored = await getStorageProvider().put(key, data, "image/webp");
  return { url: stored.url, key: stored.key, width: info.width, height: info.height, size: data.length };
}

export async function deleteStoredImage(key: string) {
  try {
    await getStorageProvider().delete(key);
  } catch (error) {
    logger.warn("media.delete_failed", { error });
  }
}
