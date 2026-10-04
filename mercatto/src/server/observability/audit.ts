import "server-only";
import { db, type Tx } from "@/server/db";
import { logger } from "@/server/observability/logger";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Trilha de auditoria para ações administrativas e críticas:
 * alteração de preço/estoque, cancelamento, reembolso, permissões, etc.
 * Nunca incluir senhas, tokens ou dados de cartão em before/after.
 */
export type AuditAction =
  | "product.created"
  | "product.updated"
  | "product.status_changed"
  | "product.price_changed"
  | "product.archived"
  | "product.duplicated"
  | "inventory.adjusted"
  | "order.status_changed"
  | "order.cancelled"
  | "refund.requested"
  | "refund.completed"
  | "payment.status_changed"
  | "user.role_changed"
  | "user.status_changed"
  | "store.status_changed"
  | "coupon.created"
  | "coupon.updated"
  | "promotion.created"
  | "promotion.updated"
  | "category.changed"
  | "brand.changed"
  | "banner.changed"
  | "settings.updated"
  | "review.moderated"
  | "question.moderated"
  | "auth.login"
  | "auth.login_failed"
  | "auth.password_reset";

export async function audit(
  entry: {
    actorId?: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    ipAddress?: string | null;
  },
  tx?: Tx,
) {
  try {
    await (tx ?? db).auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: entry.before,
        after: entry.after,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Auditoria nunca deve derrubar a operação principal fora de transações.
    if (tx) throw error;
    logger.error("audit.write_failed", { action: entry.action, error });
  }
}
