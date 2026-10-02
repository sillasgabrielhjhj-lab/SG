"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/lib/actions/notifications";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 px-0" aria-label="Notificações">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              variant="accent"
              className="absolute -top-1 -right-1 size-5 justify-center p-0 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllNotificationsReadAction()}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="size-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação por aqui ainda.
          </p>
        )}

        <div className="max-h-96 overflow-y-auto">
          {notifications.map((n) => {
            const content = (
              <div className={cn("flex flex-col gap-0.5 px-3 py-2.5 text-sm", !n.isRead && "bg-secondary/40")}>
                <div className="flex items-center gap-1.5">
                  {!n.isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  <p className="font-medium text-foreground">{n.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            );

            if (n.linkUrl) {
              return (
                <Link
                  key={n.id}
                  href={n.linkUrl}
                  onClick={() => {
                    if (!n.isRead) markNotificationReadAction(n.id);
                  }}
                  className="block border-b border-border last:border-0 hover:bg-secondary/60"
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.isRead) markNotificationReadAction(n.id);
                }}
                className="block w-full border-b border-border text-left last:border-0 hover:bg-secondary/60"
              >
                {content}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
