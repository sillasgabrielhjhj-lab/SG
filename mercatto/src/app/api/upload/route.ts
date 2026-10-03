import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCurrentUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Upload simples de imagem, salvo no disco local em public/uploads.
 * Funciona hoje sem depender de nenhum serviço externo; para produção
 * em um host com disco efêmero (ex: Vercel), trocar por um bucket
 * (S3, Cloudinary, Vercel Blob) é só substituir esta rota — nada mais
 * no formulário de produto precisa mudar.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { allowed } = await rateLimit(`upload:${user.id}`, 40, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Muitos uploads. Tente novamente mais tarde." }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Formato não suportado. Use JPG, PNG, WEBP ou GIF." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máximo 5MB)." }, { status: 400 });
  }

  const extension = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const fileName = `${randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, fileName), buffer);

  return NextResponse.json({ url: `/uploads/${fileName}` });
}
