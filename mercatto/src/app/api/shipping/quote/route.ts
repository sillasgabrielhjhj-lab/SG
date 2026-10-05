import { z } from "zod";
import { apiRoute, json } from "@/server/http";
import { parseOrThrow } from "@/server/errors";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/request";
import { cepSchema } from "@/lib/validators/br";
import { quoteForProduct } from "@/features/shipping/service";

const schema = z.object({
  cep: cepSchema,
  variantId: z.string().min(1).max(64),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

/** Simulação de frete da página de produto. */
export const POST = apiRoute(async (request) => {
  await enforceRateLimit(`shipquote:${await getClientIp()}`, 40, 60);
  const input = parseOrThrow(schema, await request.json().catch(() => ({})));
  const quote = await quoteForProduct(input.variantId, input.quantity, input.cep);
  return json({ options: quote.options, error: quote.error, freeShippingReason: quote.freeShippingReason });
});
