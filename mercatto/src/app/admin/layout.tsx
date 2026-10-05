import type { Metadata } from "next";
import { BadgePercent, Boxes, ClipboardList, CreditCard, FolderTree, Image as ImageIcon, LayoutDashboard, Megaphone, MessageSquareWarning, Package, Settings, ShieldCheck, ShoppingBag, Store, Tag, Ticket, UserCog, Users } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { hasPermission, type Permission } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { PanelNavGroup, PanelNavItem } from "@/components/layout/panel-nav";

export const metadata: Metadata = { title: { default: "Administração", template: "%s | Admin | Mercatto" }, robots: { index: false, follow: false } };

type Item = PanelNavItem & { permission: Permission };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermissionPage("admin:access", "/admin");
  const [pendingStores, pendingReviews, pendingQuestions, refundRequests] = await Promise.all([
    db.store.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.question.count({ where: { status: "PENDING" } }),
    db.order.count({ where: { status: "REFUND_REQUESTED" } }),
  ]);

  const groups: { title?: string; items: Item[] }[] = [
    { items: [{ href: "/admin", label: "Visão geral", icon: <LayoutDashboard />, exact: true, permission: "admin:access" }] },
    {
      title: "Operação",
      items: [
        { href: "/admin/pedidos", label: "Pedidos", icon: <ShoppingBag />, badge: refundRequests, permission: "admin:orders" },
        { href: "/admin/pagamentos", label: "Pagamentos", icon: <CreditCard />, permission: "admin:payments" },
        { href: "/admin/estoque", label: "Estoque", icon: <Boxes />, permission: "admin:inventory" },
      ],
    },
    {
      title: "Catálogo",
      items: [
        { href: "/admin/produtos", label: "Produtos", icon: <Package />, permission: "admin:catalog" },
        { href: "/admin/categorias", label: "Categorias", icon: <FolderTree />, permission: "admin:catalog" },
        { href: "/admin/marcas", label: "Marcas", icon: <Tag />, permission: "admin:catalog" },
      ],
    },
    {
      title: "Marketing",
      items: [
        { href: "/admin/promocoes", label: "Promoções", icon: <BadgePercent />, permission: "admin:marketing" },
        { href: "/admin/cupons", label: "Cupons", icon: <Ticket />, permission: "admin:marketing" },
        { href: "/admin/campanhas", label: "Campanhas", icon: <Megaphone />, permission: "admin:marketing" },
        { href: "/admin/banners", label: "Banners", icon: <ImageIcon />, permission: "admin:content" },
      ],
    },
    {
      title: "Pessoas",
      items: [
        { href: "/admin/clientes", label: "Clientes", icon: <Users />, permission: "admin:customers" },
        { href: "/admin/vendedores", label: "Vendedores", icon: <Store />, badge: pendingStores, permission: "admin:sellers" },
        { href: "/admin/usuarios", label: "Usuários e papéis", icon: <UserCog />, permission: "admin:users.roles" },
      ],
    },
    {
      title: "Confiança",
      items: [
        { href: "/admin/moderacao", label: "Moderação", icon: <MessageSquareWarning />, badge: pendingReviews + pendingQuestions, permission: "admin:moderation" },
        { href: "/admin/auditoria", label: "Auditoria", icon: <ClipboardList />, permission: "admin:audit" },
        { href: "/admin/configuracoes", label: "Configurações", icon: <Settings />, permission: "admin:settings" },
      ],
    },
  ];

  const visible: PanelNavGroup[] = groups
    .map((g) => ({ title: g.title, items: g.items.filter((i) => hasPermission(user.role, i.permission)).map(({ permission: _p, ...i }) => i) }))
    .filter((g) => g.items.length > 0);

  return (
    <DashboardShell
      title="Administração"
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" aria-hidden /> {user.role === "ADMIN" ? "Administrador" : "Suporte"}
        </span>
      }
      groups={visible}
      user={{ name: user.name, email: user.email }}
      sandbox={env.PAYMENT_PROVIDER === "dev"}
      publicLink={{ href: "/", label: "Ver loja" }}
    >
      {children}
    </DashboardShell>
  );
}
