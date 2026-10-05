import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/server/http";
import { parseOrThrow, notFound } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getPaymentGateway } from "@/server/providers/payments";
import { createDevWebhookRequest } from "@/server/providers/payments/dev";
import { processPaymentWebhook } from "@/features/payments/webhook.server";

const schema = z.object({ checkoutId: z.string().min(1).max(64), outcome: z.enum(["approve", "decline", "expire"]) });

/**
 * SOMENTE gateway de desenvolvimento: simula o retorno do provedor gerando um
 * webhook ASSINADO e processando-o pelo mesmo caminho de produção.
 */
export const POST = apiRoute(async (request) => {
  if (getPaymentGateway().name !== "dev") return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const user = await requireUser();
  const { checkoutId, outcome } = parseOrThrow(schema, await request.json().catch(() => ({})));
  const payment = await db.payment.findFirst({
    where: { checkoutId, checkout: { userId: user.id }, status: { in: ["PENDING", "AUTHORIZED"] } },
    orderBy: { createdAt: "desc" },
    select: { providerPaymentId: true, amountCents: true },
  });
  if (!payment?.providerPaymentId) throw notFound("Nenhum pagamento pendente para simular.");
  const status = outcome === "approve" ? "PAID" : outcome === "decline" ? "FAILED" : "EXPIRED";
  const signed = await createDevWebhookRequest({ providerPaymentId: payment.providerPaymentId, status, amountCents: status === "PAID" ? payment.amountCents : undefined });
  const result = await processPaymentWebhook("dev", signed);
  return NextResponse.json(result.body, { status: result.status });
});
