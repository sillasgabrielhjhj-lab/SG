"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { requirePermission } from "@/server/auth/guards";
import { attributeSchema, bannerSchema, brandSchema, categorySchema, settingsSchema, storeStatusSchema, userRoleSchema, userStatusSchema } from "@/features/admin/schemas";
import {
  changeStoreStatus,
  changeUserRole,
  changeUserStatus,
  deleteAttribute,
  deleteBanner,
  deleteBrand,
  deleteCategory,
  saveAttribute,
  saveBanner,
  saveBrand,
  saveCategory,
  updateSettings,
} from "@/features/admin/service";

const optId = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().max(64).optional());
const idOnly = z.object({ id: z.string().min(1).max(64) });

export const saveCategoryAction = createAction(z.object({ id: optId, input: categorySchema }), async ({ id, input }) => {
  const user = await requirePermission("admin:catalog");
  const result = await saveCategory(user.id, id ?? null, input);
  revalidatePath("/admin/categorias");
  revalidatePath("/", "layout");
  return ok(result, "Categoria salva.");
}, "admin.save_category");

export const deleteCategoryAction = createAction(idOnly, async ({ id }) => {
  const user = await requirePermission("admin:catalog");
  await deleteCategory(user.id, id);
  revalidatePath("/admin/categorias");
  return ok(undefined, "Categoria excluída.");
}, "admin.delete_category");

export const saveAttributeAction = createAction(z.object({ id: optId, input: attributeSchema }), async ({ id, input }) => {
  const user = await requirePermission("admin:catalog");
  const result = await saveAttribute(user.id, id ?? null, input);
  revalidatePath("/admin/categorias");
  return ok(result, "Atributo salvo.");
}, "admin.save_attribute");

export const deleteAttributeAction = createAction(idOnly, async ({ id }) => {
  const user = await requirePermission("admin:catalog");
  await deleteAttribute(user.id, id);
  revalidatePath("/admin/categorias");
  return ok(undefined, "Atributo excluído.");
}, "admin.delete_attribute");

export const saveBrandAction = createAction(z.object({ id: optId, input: brandSchema }), async ({ id, input }) => {
  const user = await requirePermission("admin:catalog");
  const result = await saveBrand(user.id, id ?? null, input);
  revalidatePath("/admin/marcas");
  return ok(result, "Marca salva.");
}, "admin.save_brand");

export const deleteBrandAction = createAction(idOnly, async ({ id }) => {
  const user = await requirePermission("admin:catalog");
  await deleteBrand(user.id, id);
  revalidatePath("/admin/marcas");
  return ok(undefined, "Marca excluída.");
}, "admin.delete_brand");

export const saveBannerAction = createAction(z.object({ id: optId, input: bannerSchema }), async ({ id, input }) => {
  const user = await requirePermission("admin:content");
  const result = await saveBanner(user.id, id ?? null, input);
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return ok(result, "Banner salvo.");
}, "admin.save_banner");

export const deleteBannerAction = createAction(idOnly, async ({ id }) => {
  const user = await requirePermission("admin:content");
  await deleteBanner(user.id, id);
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return ok(undefined, "Banner excluído.");
}, "admin.delete_banner");

export const updateSettingsAction = createAction(settingsSchema, async (input) => {
  const user = await requirePermission("admin:settings");
  await updateSettings(user.id, input);
  revalidatePath("/", "layout");
  return ok(undefined, "Configurações salvas.");
}, "admin.settings");

export const changeUserRoleAction = createAction(userRoleSchema, async ({ userId, role }) => {
  const user = await requirePermission("admin:users.roles");
  await changeUserRole(user.id, userId, role);
  revalidatePath("/admin/usuarios");
  return ok(undefined, "Papel atualizado. A pessoa precisará entrar novamente.");
}, "admin.user_role");

export const changeUserStatusAction = createAction(userStatusSchema, async ({ userId, status }) => {
  const user = await requirePermission("admin:customers");
  await changeUserStatus(user.id, userId, status);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/clientes");
  return ok(undefined, status === "SUSPENDED" ? "Conta suspensa." : "Conta reativada.");
}, "admin.user_status");

export const changeStoreStatusAction = createAction(storeStatusSchema, async ({ storeId, status, note }) => {
  const user = await requirePermission("admin:sellers");
  await changeStoreStatus(user.id, storeId, status, note);
  revalidatePath("/admin/vendedores");
  return ok(undefined, status === "ACTIVE" ? "Loja aprovada." : status === "SUSPENDED" ? "Loja suspensa." : "Loja em análise.");
}, "admin.store_status");
