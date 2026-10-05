import type { Metadata } from "next";
import { Bell, Heart, Home, KeyRound, MapPin, MessageCircleQuestion, Package, Star, Ticket, UserRound } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Avatar } from "@/components/ui/avatar";
import { PanelNav, type PanelNavGroup } from "@/components/layout/panel-nav";

export const metadata: Metadata = { title: { default: "Minha conta", template: "%s | Minha conta | Mercatto" }, robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage("/minha-conta");
  const [unread, pendingReviews] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.orderItem.count({ where: { reviewed: false, order: { userId: user.id, status: "DELIVERED" } } }),
  ]);

  const groups: PanelNavGroup[] = [
    {
      title: "Compras",
      items: [
        { href: "/minha-conta", label: "Resumo", icon: <Home />, exact: true },
        { href: "/minha-conta/pedidos", label: "Pedidos", icon: <Package /> },
        { href: "/minha-conta/favoritos", label: "Favoritos", icon: <Heart /> },
        { href: "/minha-conta/cupons", label: "Cupons", icon: <Ticket /> },
      ],
    },
    {
      title: "Participação",
      items: [
        { href: "/minha-conta/avaliacoes", label: "Avaliações", icon: <Star />, badge: pendingReviews },
        { href: "/minha-conta/perguntas", label: "Perguntas", icon: <MessageCircleQuestion /> },
        { href: "/minha-conta/notificacoes", label: "Notificações", icon: <Bell />, badge: unread },
      ],
    },
    {
      title: "Conta",
      items: [
        { href: "/minha-conta/dados", label: "Meus dados", icon: <UserRound /> },
        { href: "/minha-conta/enderecos", label: "Endereços", icon: <MapPin /> },
        { href: "/minha-conta/seguranca", label: "Segurança", icon: <KeyRound /> },
      ],
    },
  ];

  return (
    <div className="container-page grid gap-4 py-4 sm:py-6 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:py-8">
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
        <div className="hidden items-center gap-3 rounded-card border border-line bg-surface p-3 lg:flex">
          <Avatar name={user.name} className="size-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-fg-muted">{user.email}</p>
          </div>
        </div>
        <PanelNav groups={groups} label="Menu da conta" />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
