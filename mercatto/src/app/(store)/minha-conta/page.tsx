import Link from "next/link";
import { ArrowRight, Bell, Heart, MapPin, Package, Star, Store } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { getAccountDashboard } from "@/features/account/service";
import { OrderStatusBadge } from "@/features/orders/components/order-ui";
import { ProductImage } from "@/components/commerce/product-image";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ResendVerificationButton } from "@/features/account/components/resend-verification";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Resumo" };

export default async function AccountHomePage() {
  const user = await requireUserPage("/minha-conta");
  const data = await getAccountDashboard(user.id);
  const first = user.name.split(" ")[0];

  const shortcuts = [
    { href: "/minha-conta/pedidos", label: "Pedidos", value: data.ordersCount, icon: Package },
    { href: "/minha-conta/favoritos", label: "Favoritos", value: data.wishlistCount, icon: Heart },
    { href: "/minha-conta/avaliacoes", label: "Para avaliar", value: data.pendingReviews, icon: Star },
    { href: "/minha-conta/notificacoes", label: "Não lidas", value: data.unreadNotifications, icon: Bell },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={`Olá, ${first}!`} description="Acompanhe suas compras e gerencie sua conta." />

      {!user.emailVerifiedAt ? (
        <Alert tone="warning" title="Confirme seu e-mail" action={<ResendVerificationButton />}>
          Enviamos um link de confirmação para {user.email}. Confirmar o e-mail protege sua conta e garante que você receba as atualizações dos pedidos.
        </Alert>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {shortcuts.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-full items-center gap-3 rounded-card border border-line bg-surface p-4 transition-shadow hover:shadow-raised focus-ring">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                <s.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-xl font-extrabold tabular">{s.value}</span>
                <span className="block text-xs text-fg-muted">{s.label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="recent-orders" className="rounded-card border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="recent-orders" className="font-bold">
            Últimos pedidos
          </h2>
          {data.ordersCount > 0 ? (
            <Link href="/minha-conta/pedidos" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              Ver todos <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
        {data.orders.length === 0 ? (
          <EmptyState compact icon={<Package />} title="Você ainda não fez pedidos" description="Quando comprar, você acompanha tudo por aqui." action={<ButtonLink href="/">Explorar ofertas</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-line">
            {data.orders.map((o) => (
              <li key={o.id}>
                <Link href={`/minha-conta/pedidos/${o.number}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/60 focus-ring">
                  <div className="flex -space-x-3">
                    {o.items.slice(0, 3).map((item, i) => (
                      <span key={i} className="relative size-12 overflow-hidden rounded-md border-2 border-surface bg-white">
                        <ProductImage src={item.imageUrl} alt="" sizes="48px" />
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {o.items[0]?.productName}
                      {o._count.items > 1 ? <span className="font-normal text-fg-muted"> e mais {o._count.items - 1}</span> : null}
                    </p>
                    <p className="text-xs text-fg-muted">
                      Pedido {o.number} · {formatDate(o.createdAt)} · {o.store.name}
                    </p>
                  </div>
                  <div className="hidden flex-col items-end gap-1 sm:flex">
                    <OrderStatusBadge status={o.status} />
                    <span className="text-sm font-bold tabular">{formatBRL(o.totalCents)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/minha-conta/enderecos" className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 hover:shadow-raised focus-ring">
          <MapPin className="size-5 text-brand-700" aria-hidden />
          <span className="flex-1">
            <span className="block text-sm font-semibold">Endereços</span>
            <span className="block text-xs text-fg-muted">{data.addressesCount ? `${data.addressesCount} cadastrado(s)` : "Cadastre um endereço para agilizar suas compras"}</span>
          </span>
          <ArrowRight className="size-4 text-fg-subtle" aria-hidden />
        </Link>
        {user.storeId ? (
          <Link href="/vendedor" className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 hover:shadow-raised focus-ring">
            <Store className="size-5 text-brand-700" aria-hidden />
            <span className="flex-1">
              <span className="block text-sm font-semibold">Painel do vendedor</span>
              <span className="block text-xs text-fg-muted">Gerencie sua loja, produtos e pedidos</span>
            </span>
            <ArrowRight className="size-4 text-fg-subtle" aria-hidden />
          </Link>
        ) : (
          <Link href="/vender" className="flex items-center gap-3 rounded-card border border-brand-200 bg-brand-50 p-4 hover:shadow-raised focus-ring">
            <Store className="size-5 text-brand-700" aria-hidden />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-brand-900">Venda na Mercatto</span>
              <span className="block text-xs text-brand-800">Abra sua loja e alcance clientes de todo o Brasil</span>
            </span>
            <ArrowRight className="size-4 text-brand-700" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
