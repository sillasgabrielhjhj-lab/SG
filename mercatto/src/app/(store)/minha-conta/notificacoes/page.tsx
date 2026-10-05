import { requireUserPage } from "@/server/auth/guards";
import { listNotifications } from "@/features/notifications/queries";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { PageHeading } from "@/components/layout/page-heading";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Notificações" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const user = await requireUserPage("/minha-conta/notificacoes");
  const page = Math.max(1, Number((await searchParams).pagina) || 1);
  const data = await listNotifications(user.id, { page });
  return (
    <div>
      <PageHeading title="Notificações" description={data.unread ? `${data.unread} não lida(s)` : "Tudo lido"} />
      <NotificationList unread={data.unread} items={data.items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))} />
      <Pagination className="mt-6" page={page} totalPages={data.totalPages} buildHref={(p) => `/minha-conta/notificacoes${p > 1 ? `?pagina=${p}` : ""}`} />
    </div>
  );
}
