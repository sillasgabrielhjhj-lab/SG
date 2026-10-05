"use server";

import { runAction, ok } from "@/server/action";
import { requireUser } from "@/server/auth/guards";
import { handleUploadForm } from "@/features/media/upload.server";

/** Upload de imagens via Server Action (FormData: files[], folder). */
export async function uploadImagesAction(form: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const files = await handleUploadForm(user, form);
    return ok({ files });
  }, "media.upload");
}
