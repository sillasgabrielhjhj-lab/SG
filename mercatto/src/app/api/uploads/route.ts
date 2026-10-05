import { apiRoute, json } from "@/server/http";
import { requireUser } from "@/server/auth/guards";
import { handleUploadForm } from "@/features/media/upload.server";

export const runtime = "nodejs";

/** POST multipart/form-data: files (até 10) + folder. */
export const POST = apiRoute(async (request) => {
  const user = await requireUser();
  const form = await request.formData();
  const files = await handleUploadForm(user, form);
  return json({ files });
});
