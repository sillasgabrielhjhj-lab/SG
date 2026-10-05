import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Package, Truck } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { getCheckoutForPayment } from "@/features/checkout/queries";
import { privateMetadata } from "@/features/seo/metadata";
import { ButtonLink } from "@/components/ui/button";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { ProductImage } from "@/components/commerce/product-image";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = privateMetadata("Compra confirmada");

type Props = { params: Promise<{ checkoutId: string }> };

export default async function ConfirmationPage({ params }: Props) {
  const { checkoutId } = await params;
  const user = await requireUserPage(`/checkout/confirmacao/${checkoutId}`);
  const checkout = await getCheckoutForPayment(user.id, checkoutId);
  if (checkout.status !== "PAID") redirect(`/checkout/pagamento/${checkoutId}`);
  const address = checkout.shippingAddress as { street: string; number: string; city: string; state: string };
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="rounded-card border border-line bg-surface px-4 py-4">
        <ProgressSteps steps={["Identificação", "Endereço", "Entrega", "Pagamento", "Revisão", "Confirmação"]} current={6} />
      </div>
      <section className="flex flex-col items-center gap-2 rounded-panel bg-brand-800 px-5 py-8 text-center text-white">
        <CheckCircle2 className="size-14 animate-pop text-sun-300" aria-hidden />
        <h1 className="text-2xl font-extrabold tracking-tight">Pagamento aprovado!</h1>
        <p className="max-w-md text-sm text-white/85">Enviamos a confirmação para o seu e-mail. Você pode acompanhar cada pedido em “Meus pedidos”.</p>
        {checkout.gateway.isSandbox ? <p className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Pagamento simulado — ambiente de demonstração</p> : null}
      </section>
      {checkout.orders.map((o) => (
        <section key={o.id} className="rounded-panel border border-line bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Package className="size-4 text-brand-700" aria-hidden /> Pedido {o.number} · {o.store.isOfficial ? "Mercatto" : o.store.name}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-fg-muted">
              <Truck className="size-4" aria-hidden /> {o.shippingService} · até {o.shippingEtaDays} dias úteis
            </span>
          </header>
          <ul className="divide-y divide-line">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <ProductImage src={i.imageUrl} alt={i.productName} className="size-14 shrink-0 rounded-md border border-line" sizes="56px" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="line-clamp-1">{i.productName}</span>
                  <span className="text-xs text-fg-muted">
                    {i.variantName !== "Padrão" ? `${i.variantName} · ` : ""}
                    {i.quantity} un.
                  </span>
                </span>
                <span className="text-sm font-semibold tabular">{formatBRL(i.totalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end px-4 py-3">
            <ButtonLink href={`/minha-conta/pedidos/${o.number}`} variant="outline" size="sm">
              Acompanhar pedido
            </ButtonLink>
          </div>
        </section>
      ))}
      <p className="text-center text-sm text-fg-muted">
        Entrega em {address.street}, {address.number} — {address.city}/{address.state}
      </p>
      <div className="flex justify-center gap-2">
        <ButtonLink href="/">Continuar comprando</ButtonLink>
        <ButtonLink href="/minha-conta/pedidos" variant="outline">
          Meus pedidos
        </ButtonLink>
      </div>
    </div>
  );
}
