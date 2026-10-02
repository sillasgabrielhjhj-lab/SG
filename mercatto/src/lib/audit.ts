import "server-only";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

export async function logAudit(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const h = await headers();
  const ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim();

  await prisma.auditLog
    .create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        ipAddress,
      },
    })
    .catch((error) => {
      console.error("Falha ao gravar audit log", error);
    });
}
