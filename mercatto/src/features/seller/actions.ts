"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requireSeller, requireUser } from "@/server/auth/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { createStoreSchema, shippingRuleSchema, storeProfileSchema } from "@/features/seller/schemas";
import { createSellerStore, replaceShippingRules, updateStoreProfile } from "@/features/seller/service";

export const createStoreAction = createAction(createStoreSchema, async ({ acceptSellerTerms: _accepted, ...input }) => {
  const user = await requireUser();
  await enforceRateLimit(`create-store:${user.id}`, 5, 3600);
  const store = await createSellerStore(user.id, input);
  revalidatePath("/vendedor");
  return ok(store, "Loja criada! Ela será analisada pela equipe Mercatto — enquanto isso, cadastre seus produtos como rascunho.");
}, "seller.create_store");

export const updateStoreProfileAction = createAction(storeProfileSchema, async (input) => {
  const user = await requireSeller();
  const result = await updateStoreProfile(user.storeId, user.id, input);
  revalidatePath("/vendedor/loja");
  revalidatePath(`/loja/${result.slug}`);
  return ok(result, "Dados da loja atualizados.");
}, "seller.update_store");

export const replaceShippingRulesAction = createAction(z.object({ rules: z.array(shippingRuleSchema).max(100) }), async ({ rules }) => {
  const user = await requireSeller();
  await replaceShippingRules(user.storeId, user.id, rules.map(({ id: _id, ...r }) => r));
  revalidatePath("/vendedor/loja");
  return ok(undefined, "Tabela de frete atualizada.");
}, "seller.shipping_rules");
