"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok, runAction } from "@/server/action";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";

export const markNotificationReadAction = createAction(z.object({ id: z.string().min(1).max(64) }), async ({ id }) => {
  const user = await requireUser();
  // Escopo pelo usuário: impossível marcar notificação de outra pessoa (IDOR).
  await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/minha-conta/notificacoes");
  return ok(undefined);
}, "notifications.read");

export async function markAllNotificationsReadAction() {
  return runAction(async () => {
    const user = await requireUser();
    await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/minha-conta/notificacoes");
    return ok(undefined, "Todas as notificações foram marcadas como lidas.");
  }, "notifications.read_all");
}
