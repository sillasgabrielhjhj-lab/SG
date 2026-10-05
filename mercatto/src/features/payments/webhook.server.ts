import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { logger } from "@/server/observability/logger";
import { getPaymentGateway } from "@/server/providers/payments";
import { applyPaymentStatus } from "@/features/payments/service";

export type WebhookResult = { status: number; body: { ok: boolean; message: string } };

/**
 * Processa um webhook de pagamento. Mesma rota de código para produção e
 * para a simulação do gateway dev:
 *  1. provedor da URL deve ser o gateway ativo;
 *  2. assinatura validada pelo gateway (HMAC, anti-replay) e status consultado;
 *  3. registro idempotente (provider + eventId únicos) — duplicatas retornam 200 sem reprocessar;
 *  4. aplica a transição de pagamento.
 */
export async function processPaymentWebhook(providerFromUrl: string, request: { headers: Headers; rawBody: string; url: string }): Promise<WebhookResult> {
  const gateway = getPaymentGateway();
  if (providerFromUrl !== gateway.name) return { status: 404, body: { ok: false, message: "Provedor desconhecido." } };

  const verification = await gateway.verifyWebhook(request);
  if (!verification.ok) {
    if (verification.ignorable) return { status: 200, body: { ok: true, message: "Evento ignorado." } };
    logger.warn("webhook.rejected", { provider: gateway.name, reason: verification.reason });
    return { status: 401, body: { ok: false, message: "Assinatura inválida." } };
  }

  let eventRowId: string;
  try {
    const row = await db.webhookEvent.create({
      data: { provider: gateway.name, eventId: verification.eventId, type: verification.type, payload: JSON.parse(request.rawBody || "{}") as Prisma.InputJsonValue },
      select: { id: true },
    });
    eventRowId = row.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.webhookEvent.findUnique({ where: { provider_eventId: { provider: gateway.name, eventId: verification.eventId } }, select: { id: true, processedAt: true } });
      if (existing?.processedAt) return { status: 200, body: { ok: true, message: "Evento já processado." } };
      if (!existing) throw error;
      eventRowId = existing.id; // registro anterior falhou no processamento: tenta de novo
    } else {
      throw error;
    }
  }

  try {
    await applyPaymentStatus({
      provider: gateway.name,
      providerPaymentId: verification.providerPaymentId,
      status: verification.status,
      eventId: verification.eventId,
      paidAmountCents: verification.paidAmountCents,
    });
    await db.webhookEvent.update({ where: { id: eventRowId }, data: { processedAt: new Date(), error: null } });
    return { status: 200, body: { ok: true, message: "Processado." } };
  } catch (error) {
    logger.error("webhook.processing_failed", { provider: gateway.name, eventId: verification.eventId, error });
    await db.webhookEvent.update({ where: { id: eventRowId }, data: { error: error instanceof Error ? error.message.slice(0, 500) : "erro" } }).catch(() => undefined);
    // 500 => o provedor reenviará o evento.
    return { status: 500, body: { ok: false, message: "Erro ao processar." } };
  }
}
