"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroyAllSessions, createSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import {
  updateProfileSchema,
  changePasswordSchema,
  addressSchema,
} from "@/lib/validation/account";
import type { ActionState } from "@/lib/actions/auth";

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  });

  await logAudit({ userId: user.id, action: "PROFILE_UPDATED", entityType: "User", entityId: user.id });

  revalidatePath("/minha-conta");
  return { status: "success", message: "Dados atualizados com sucesso." };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const fullUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const valid = await verifyPassword(parsed.data.currentPassword, fullUser.passwordHash);

  if (!valid) {
    return {
      status: "error",
      fieldErrors: { currentPassword: ["Senha atual incorreta"] },
    };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Derruba todas as sessões (inclusive esta) e cria uma nova — padrão de
  // segurança para troca de senha.
  await destroyAllSessions(user.id);
  await createSession(user.id);

  await logAudit({ userId: user.id, action: "PASSWORD_CHANGED", entityType: "User", entityId: user.id });

  return { status: "success", message: "Senha alterada com sucesso." };
}

export async function createAddressAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = addressSchema.safeParse({
    label: formData.get("label"),
    recipientName: formData.get("recipientName"),
    zipCode: formData.get("zipCode"),
    street: formData.get("street"),
    number: formData.get("number"),
    complement: formData.get("complement"),
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    state: formData.get("state"),
    isDefault: formData.get("isDefault"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const addressCount = await prisma.address.count({ where: { userId: user.id } });

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault || addressCount === 0) {
      await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }

    await tx.address.create({
      data: {
        userId: user.id,
        label: parsed.data.label || null,
        recipientName: parsed.data.recipientName,
        zipCode: parsed.data.zipCode,
        street: parsed.data.street,
        number: parsed.data.number,
        complement: parsed.data.complement || null,
        neighborhood: parsed.data.neighborhood,
        city: parsed.data.city,
        state: parsed.data.state,
        isDefault: parsed.data.isDefault || addressCount === 0,
      },
    });
  });

  await logAudit({ userId: user.id, action: "ADDRESS_CREATED", entityType: "Address", entityId: user.id });

  revalidatePath("/minha-conta/enderecos");
  revalidatePath("/checkout");
  return { status: "success", message: "Endereço adicionado." };
}

export async function deleteAddressAction(addressId: string) {
  const user = await requireUser();

  await prisma.address.deleteMany({ where: { id: addressId, userId: user.id } });

  await logAudit({ userId: user.id, action: "ADDRESS_DELETED", entityType: "Address", entityId: addressId });

  revalidatePath("/minha-conta/enderecos");
}

export async function revokeSessionAction(sessionId: string) {
  const user = await requireUser();

  await prisma.session.updateMany({
    where: { id: sessionId, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await logAudit({ userId: user.id, action: "SESSION_REVOKED", entityType: "Session", entityId: sessionId });

  revalidatePath("/minha-conta/seguranca");
}

export async function setDefaultAddressAction(addressId: string) {
  const user = await requireUser();

  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    prisma.address.updateMany({
      where: { id: addressId, userId: user.id },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/minha-conta/enderecos");
}
