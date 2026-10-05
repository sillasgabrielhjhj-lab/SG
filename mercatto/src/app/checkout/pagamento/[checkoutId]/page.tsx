import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserPage } from "@/server/auth/guards";
import { getCheckoutForPayment } from "@/features/checkout/queries";
import { privateMetadata } from "@/features/seo/metadata";
import { PaymentStatus } from "@/features/checkout/components/payment-status";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = privateMetadata("Pagamento");

type Props = { params: Promise<{ checkoutId: string }> };

export default async function PaymentPage({ params }: Props) {
  const { checkoutId } = await params;
  const user = await requireUserPage(`/checkout/pagamento/${checkoutId}`);
  const checkout = await getCheckoutForPayment(user.id, checkoutId);
  if (checkout.status === "PAID") redirect(`/checkout/confirmacao/${checkoutId}`);
  const p = checkout.currentPayment;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="rounded-card border border-line bg-surface px-4 py-4">
        <ProgressSteps steps={["Identificação", "Endereço", "Entrega", "Pagamento", "Revisão", "Confirmação"]} current={5} />
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Pagamento</h1>
        <p className="text-sm text-fg-muted">
          Pedido(s) {checkout.orders.map((o) => o.number).join(", ")} · Total {formatBRL(checkout.totalCents)}
        </p>
      </div>
      <PaymentStatus
        checkoutId={checkout.id}
        status={checkout.status}
        expiresAt={checkout.expiresAt.toISOString()}
        totalCents={checkout.totalCents}
        gateway={checkout.gateway}
        payment={p ? { ...p, pixExpiresAt: p.pixExpiresAt?.toISOString() ?? null } : null}
      />
    </div>
  );
}
