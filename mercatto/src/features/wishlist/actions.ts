"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { createAction, ok } from "@/server/action";
import { requireUser } from "@/server/auth/guards";
import { notFound } from "@/server/errors";
import { enforceRateLimit } from "@/server/security/rate-limit";

const toggleSchema = z.object({ productId: z.string().min(1).max(64) });

/** Favorita/desfavorita um produto. Exige login (UNAUTHENTICATED => cliente redireciona para /entrar). */
export const toggleWishlistAction = createAction(
  toggleSchema,
  async ({ productId }) => {
    const user = await requireUser();
    await enforceRateLimit(`wishlist:${user.id}`, 60, 60);
    const product = await db.product.findFirst({
      where: { id: productId, status: { in: ["ACTIVE", "OUT_OF_STOCK", "PAUSED"] } },
      select: { id: true },
    });
    if (!product) throw notFound("Produto não encontrado.");
    const existing = await db.wishlistItem.findUnique({
      where: { userId_productId: { userId: user.id, productId } },
      select: { id: true },
    });
    if (existing) {
      await db.wishlistItem.delete({ where: { id: existing.id } });
      return ok({ favorited: false }, "Removido dos favoritos");
    }
    await db.wishlistItem.create({ data: { userId: user.id, productId } });
    return ok({ favorited: true }, "Adicionado aos favoritos");
  },
  "wishlist.toggle",
);

const storeSchema = z.object({ storeId: z.string().min(1).max(64) });

/** Segue/deixa de seguir uma loja (lojas favoritas). */
export const toggleFavoriteStoreAction = createAction(
  storeSchema,
  async ({ storeId }) => {
    const user = await requireUser();
    await enforceRateLimit(`favstore:${user.id}`, 60, 60);
    const store = await db.store.findFirst({ where: { id: storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) throw notFound("Loja não encontrada.");
    const existing = await db.favoriteStore.findUnique({
      where: { userId_storeId: { userId: user.id, storeId } },
      select: { id: true },
    });
    if (existing) {
      await db.favoriteStore.delete({ where: { id: existing.id } });
      return ok({ favorited: false }, "Você deixou de seguir a loja");
    }
    await db.favoriteStore.create({ data: { userId: user.id, storeId } });
    return ok({ favorited: true }, "Você está seguindo a loja");
  },
  "wishlist.toggle_store",
);
