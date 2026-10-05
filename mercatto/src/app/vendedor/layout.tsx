import type { Metadata } from "next";
import { BarChart3, Boxes, MessageCircleQuestion, Package, Percent, ShoppingBag, Star, Store, Ticket } from "lucide-react";
import { requireSellerPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { PanelNavGroup } from "@/components/layout/panel-nav";

export const metadata: Metadata = { title: { default: "Painel do vendedor", template: "%s | Vendedor | Mercatto" }, robots: { index: false, follow: false } };

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSellerPage("/vendedor");
  const [store, toShip, unanswered] = await Promise.all([
    db.store.findUniqueOrThrow({ where: { id: user.storeId }, select: { name: true, slug: true, status: true, isOfficial: true } }),
    db.order.count({ where: { storeId: user.storeId, status: { in: ["PAID", "PROCESSING"] } } }),
    db.question.count({ where: { product: { storeId: user.storeId }, status: "PUBLISHED", answer: { is: null } } }),
  ]);
  const groups: PanelNavGroup[] = [
    { items: [{ href: "/vendedor", label: "Visão geral", icon: <BarChart3 />, exact: true }] },
    {
      title: "Vendas",
      items: [
        { href: "/vendedor/pedidos", label: "Pedidos", icon: <ShoppingBag />, badge: toShip },
        { href: "/vendedor/perguntas", label: "Perguntas", icon: <MessageCircleQuestion />, badge: unanswered },
        { href: "/vendedor/avaliacoes", label: "Avaliações", icon: <Star /> },
      ],
    },
    {
      title: "Catálogo",
      items: [
        { href: "/vendedor/produtos", label: "Produtos", icon: <Package /> },
        { href: "/vendedor/estoque", label: "Estoque", icon: <Boxes /> },
      ],
    },
    {
      title: "Marketing",
      items: [
        { href: "/vendedor/promocoes", label: "Promoções", icon: <Percent /> },
        { href: "/vendedor/cupons", label: "Cupons", icon: <Ticket /> },
      ],
    },
    { title: "Loja", items: [{ href: "/vendedor/loja", label: "Dados e frete", icon: <Store /> }] },
  ];
  return (
    <DashboardShell
      title="Painel do vendedor"
      subtitle={store.name}
      groups={groups}
      user={{ name: user.name, email: user.email }}
      sandbox={env.PAYMENT_PROVIDER === "dev"}
      publicLink={store.status === "ACTIVE" ? { href: store.isOfficial ? "/oficial" : `/loja/${store.slug}`, label: "Ver minha loja" } : undefined}
    >
      {store.status !== "ACTIVE" ? (
        <div role="status" className="mb-5 rounded-card border border-warning-600/30 bg-warning-50 p-4 text-sm text-warning-700">
          <p className="font-bold">{store.status === "PENDING" ? "Sua loja está em análise" : "Sua loja está suspensa"}</p>
          <p>{store.status === "PENDING" ? "Você já pode cadastrar produtos como rascunho. Eles poderão ser publicados assim que a Mercatto aprovar a loja." : "Seus produtos não aparecem na vitrine. Entre em contato com o suporte para regularizar."}</p>
        </div>
      ) : null}
      {children}
    </DashboardShell>
  );
}
