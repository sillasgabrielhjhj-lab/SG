"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requireUser } from "@/server/auth/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { addressSchema } from "@/lib/validators/br";
import { checkbox } from "@/lib/validators/common";
import { profileSchema } from "@/features/account/schemas";
import { createAddress, deleteAddress, setDefaultAddress, updateAddress, updateProfile } from "@/features/account/service";

const addressWithDefault = addressSchema.extend({ isDefault: checkbox.optional() });
const addressIdSchema = z.object({ addressId: z.string().min(1).max(64) });

export const updateProfileAction = createAction(profileSchema, async (input) => {
  const user = await requireUser();
  await enforceRateLimit(`profile:${user.id}`, 20, 3600);
  await updateProfile(user.id, input);
  revalidatePath("/minha-conta");
  return ok(undefined, "Dados atualizados.");
}, "account.update_profile");

export const createAddressAction = createAction(addressWithDefault, async (input) => {
  const user = await requireUser();
  await enforceRateLimit(`address:${user.id}`, 30, 3600);
  const address = await createAddress(user.id, input);
  revalidatePath("/minha-conta/enderecos");
  revalidatePath("/checkout");
  return ok({ id: address.id }, "Endereço salvo.");
}, "account.create_address");

export const updateAddressAction = createAction(addressWithDefault.extend({ addressId: z.string().min(1).max(64) }), async ({ addressId, ...input }) => {
  const user = await requireUser();
  await updateAddress(user.id, addressId, input);
  revalidatePath("/minha-conta/enderecos");
  revalidatePath("/checkout");
  return ok(undefined, "Endereço atualizado.");
}, "account.update_address");

export const deleteAddressAction = createAction(addressIdSchema, async ({ addressId }) => {
  const user = await requireUser();
  await deleteAddress(user.id, addressId);
  revalidatePath("/minha-conta/enderecos");
  return ok(undefined, "Endereço removido.");
}, "account.delete_address");

export const setDefaultAddressAction = createAction(addressIdSchema, async ({ addressId }) => {
  const user = await requireUser();
  await setDefaultAddress(user.id, addressId);
  revalidatePath("/minha-conta/enderecos");
  return ok(undefined, "Endereço principal definido.");
}, "account.default_address");

export const revokeSessionAction = createAction(z.object({ sessionId: z.string().min(1).max(64) }), async ({ sessionId }) => {
  const user = await requireUser();
  const { db } = await import("@/server/db");
  await db.session.deleteMany({ where: { id: sessionId, userId: user.id } });
  revalidatePath("/minha-conta/seguranca");
  return ok(undefined, "Sessão encerrada.");
}, "account.revoke_session");
