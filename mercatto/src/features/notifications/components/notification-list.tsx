"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertTriangle, Bell, CheckCheck, CreditCard, MessageCircle, Package, PackageCheck, PackageX, Star, Tag, Ticket, Truck } from "lucide-react";
import type { NotificationType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/features/notifications/actions";

const ICONS: Record<NotificationType, typeof Bell> = {
  ORDER_PAID: CreditCard,
  ORDER_SHIPPED: Truck,
  ORDER_DELIVERED: PackageCheck,
  ORDER_CANCELLED: PackageX,
  PAYMENT_FAILED: AlertTriangle,
  PRICE_DROP: Tag,
  QUESTION_ANSWERED: MessageCircle,
  NEW_QUESTION: MessageCircle,
  NEW_ORDER: Package,
  COUPON_AVAILABLE: Ticket,
  REVIEW_REQUEST: Star,
  LOW_STOCK: AlertTriangle,
  SYSTEM: Bell,
};

export type NotificationRow = { id: string; type: NotificationType; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

export function NotificationList({ items, unread }: { items: NotificationRow[]; unread: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface">
        <EmptyState icon={<Bell />} title="Nenhuma notificação" description="Avisos sobre pedidos, pagamentos e respostas aparecem aqui." />
      </div>
    );
  }

  const open = (n: NotificationRow) => {
    if (!n.readAt) void markNotificationReadAction({ id: n.id });
  };

  return (
    <div className="flex flex-col gap-3">
      {unread > 0 ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            leftIcon={<CheckCheck className="size-4" />}
            onClick={() =>
              start(async () => {
                const res = await markAllNotificationsReadAction();
                if (res.ok) router.refresh();
                else toast.error(res.error);
              })
            }
          >
            Marcar todas como lidas
          </Button>
        </div>
      ) : null}
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {items.map((n) => {
          const Icon = ICONS[n.type];
          const content = (
            <>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", n.readAt ? "bg-surface-muted text-fg-subtle" : "bg-brand-50 text-brand-700")}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", n.readAt ? "font-medium text-fg-muted" : "font-bold text-fg")}>
                  {n.title}
                  {!n.readAt ? <span className="sr-only"> (não lida)</span> : null}
                </span>
                <span className="block text-sm text-fg-muted">{n.body}</span>
                <span className="block text-xs text-fg-subtle">{formatRelative(n.createdAt)}</span>
              </span>
              {!n.readAt ? <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-coral-500" /> : null}
            </>
          );
          return (
            <li key={n.id}>
              {n.link ? (
                <Link href={n.link} onClick={() => open(n)} className={cn("flex items-start gap-3 p-4 hover:bg-surface-muted/60 focus-ring", !n.readAt && "bg-brand-50/40")}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={() => (open(n), router.refresh())} className={cn("flex w-full items-start gap-3 p-4 text-left hover:bg-surface-muted/60 focus-ring", !n.readAt && "bg-brand-50/40")}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
