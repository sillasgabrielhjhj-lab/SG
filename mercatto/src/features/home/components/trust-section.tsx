import Link from "next/link";
import type { CSSProperties } from "react";
import { CreditCard, Headset, RotateCcw, ShieldCheck, Truck } from "lucide-react";

/**
 * "Por que comprar na Mercatto" — cada afirmação corresponde a um recurso real:
 * pagamento pelo gateway, rastreio em "Meus pedidos", devolução solicitada no
 * pedido (até 7 dias após a entrega) e central de ajuda.
 */
export function TrustSection({ paymentLabel }: { paymentLabel: string }) {
  const items = [
    { icon: ShieldCheck, title: "Compra protegida", text: "Seu pagamento fica protegido, em ambiente criptografado.", href: "/seguranca" },
    { icon: Truck, title: "Entrega acompanhada", text: "Acompanhe seu pedido até chegar.", href: "/minha-conta/pedidos" },
    { icon: CreditCard, title: "Pagamento facilitado", text: paymentLabel, href: "/ajuda" },
    { icon: RotateCcw, title: "Devolução fácil", text: "Solicite diretamente pela plataforma.", href: "/trocas-e-devolucoes" },
    { icon: Headset, title: "Suporte", text: "Estamos aqui para ajudar.", href: "/ajuda" },
  ];
  return (
    <section data-reveal data-trust-section aria-labelledby="trust-title" className="rounded-banner border border-line bg-surface px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold tracking-wider text-brand-700 uppercase">Por que comprar na Mercatto?</p>
        <h2 id="trust-title" className="mt-1 text-xl font-extrabold tracking-tight text-balance text-fg sm:text-2xl">
          Comprar na Mercatto é simples e seguro
        </h2>
      </div>
      <ul data-stagger className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
        {items.map(({ icon: Icon, title, text, href }, i) => (
          <li key={title} style={{ "--i": i } as CSSProperties} className={i === items.length - 1 ? "col-span-2 md:col-span-1" : undefined}>
            <Link href={href} className="hover-lift group flex h-full flex-col items-center gap-2 rounded-card bg-surface-muted px-3 py-4 text-center ring-1 ring-line hover:bg-surface hover:ring-brand-200 focus-ring">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-800 text-sun-300 shadow-sm transition-transform duration-200 group-hover:scale-105">
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="text-sm font-bold text-fg">{title}</span>
              <span className="text-xs leading-snug text-fg-muted">{text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
