import { buildStaticPix, PixError } from "@/lib/pix/brcode";
import type { PixSetup } from "@/lib/pix/setup";
import type { PixPayment } from "./types";

export type PaymentResult = { ok: true; payment: PixPayment } | { ok: false; message: string };

/** Provedor atual: Pix estático gerado localmente (sem gateway, sem custo). */
export function createStaticPixPayment(
  amountCents: number,
  setup: Extract<PixSetup, { status: "ready" }>,
): PaymentResult {
  try {
    const payload = buildStaticPix({
      key: setup.key,
      receiverName: setup.receiverName,
      receiverCity: setup.receiverCity,
      description: setup.description,
      amountCents,
    });
    return { ok: true, payment: { amountCents, payload, status: "unconfirmed" } };
  } catch (error) {
    const message =
      error instanceof PixError ? error.message : "Não foi possível gerar o código Pix.";
    return { ok: false, message };
  }
}
