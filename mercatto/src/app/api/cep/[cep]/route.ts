import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { AppError } from "@/server/errors";
import { getClientIp } from "@/server/security/request";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getCepProvider } from "@/server/providers/cep";
import { ufFromCep } from "@/lib/cep-ranges";
import { isValidCep } from "@/lib/validators/br";

export const GET = apiRoute<{ params: Promise<{ cep: string }> }>(async (_request, { params }) => {
  const cep = (await params).cep.replace(/\D/g, "");
  if (!isValidCep(cep)) throw new AppError("VALIDATION", "CEP inválido.");
  await enforceRateLimit(`cep:${await getClientIp()}`, 30, 60);
  let address;
  try {
    address = await getCepProvider().lookup(cep);
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o CEP agora. Preencha o endereço manualmente.", code: "UNAVAILABLE" }, { status: 503 });
  }
  if (!address) return NextResponse.json({ error: "CEP não encontrado. Confira o número ou preencha manualmente.", code: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(
    { ...address, state: address.state || ufFromCep(cep) || "" },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
});
