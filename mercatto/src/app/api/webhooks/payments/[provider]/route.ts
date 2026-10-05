import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http";
import { processPaymentWebhook } from "@/features/payments/webhook.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Webhook do gateway de pagamento. Sem CSRF (chamada servidor-a-servidor); autenticado por assinatura. */
export const POST = apiRoute<{ params: Promise<{ provider: string }> }>(
  async (request, { params }) => {
    const { provider } = await params;
    const rawBody = await request.text();
    if (rawBody.length > 256 * 1024) return NextResponse.json({ ok: false }, { status: 413 });
    const result = await processPaymentWebhook(provider, { headers: request.headers, rawBody, url: request.url });
    return NextResponse.json(result.body, { status: result.status });
  },
  { csrf: false },
);
