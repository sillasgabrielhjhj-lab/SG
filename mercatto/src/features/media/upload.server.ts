import "server-only";
import { AppError, forbidden } from "@/server/errors";
import { hasPermission, type Permission } from "@/server/auth/rbac";
import type { SessionUser } from "@/server/auth/session";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { processImageUpload, UPLOAD_FOLDERS, type UploadFolder } from "@/features/media/service";

const FOLDER_PERMISSIONS: Record<UploadFolder, Permission[] | "any-user"> = {
  products: ["seller:products", "admin:catalog"],
  stores: ["seller:access", "admin:sellers"],
  banners: ["admin:content", "admin:catalog"],
  categories: ["admin:catalog"],
  brands: ["admin:catalog"],
  reviews: "any-user",
};

export function assertCanUpload(user: SessionUser, folder: string): UploadFolder {
  if (!(UPLOAD_FOLDERS as readonly string[]).includes(folder)) throw new AppError("VALIDATION", "Destino de upload inválido.");
  const rule = FOLDER_PERMISSIONS[folder as UploadFolder];
  if (rule !== "any-user" && !rule.some((p) => hasPermission(user.role, p))) throw forbidden("Você não pode enviar imagens para este destino.");
  return folder as UploadFolder;
}

/** Processa os arquivos de um FormData ("files" + "folder"), com resultado por arquivo. */
export async function handleUploadForm(user: SessionUser, form: FormData) {
  const folder = assertCanUpload(user, String(form.get("folder") ?? ""));
  const files = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (files.length === 0) throw new AppError("VALIDATION", "Nenhum arquivo enviado.");
  if (files.length > 10) throw new AppError("VALIDATION", "Envie no máximo 10 imagens por vez.");
  await enforceRateLimit(`upload:${user.id}`, 60, 60 * 10);
  const results = [];
  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const image = await processImageUpload(buffer, { originalName: file.name, declaredType: file.type, folder });
      results.push({ ok: true as const, name: file.name, ...image });
    } catch (error) {
      results.push({ ok: false as const, name: file.name, error: error instanceof AppError ? error.message : "Falha ao processar a imagem." });
    }
  }
  return results;
}
