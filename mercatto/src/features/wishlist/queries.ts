import "server-only";
import { db } from "@/server/db";

/** Ids de produtos favoritados (para marcar corações em listagens). */
export async function getWishlistProductIds(userId: string): Promise<Set<string>> {
  const rows = await db.wishlistItem.findMany({ where: { userId }, select: { productId: true } });
  return new Set(rows.map((r) => r.productId));
}

export async function isStoreFavorited(userId: string, storeId: string) {
  const row = await db.favoriteStore.findUnique({ where: { userId_storeId: { userId, storeId } }, select: { id: true } });
  return Boolean(row);
}
