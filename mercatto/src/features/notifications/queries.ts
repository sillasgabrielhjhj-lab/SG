import "server-only";
import { db } from "@/server/db";

const PAGE = 20;

export async function listNotifications(userId: string, opts: { page?: number; unreadOnly?: boolean } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const where = { userId, ...(opts.unreadOnly ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, total, unread, page, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
}

export const unreadCount = (userId: string) => db.notification.count({ where: { userId, readAt: null } });
