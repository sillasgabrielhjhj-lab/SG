import type { Metadata } from "next";
import { Heart } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Favoritos" };

export default async function WishlistPage() {
  const user = await requireUser();

  const wishlist = await prisma.wishlist.findMany({
    where: { userId: user.id },
    include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Favoritos</h1>
        <p className="text-sm text-muted-foreground">Produtos que você salvou.</p>
      </div>

      {wishlist.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Heart className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Você ainda não adicionou nenhum produto aos favoritos.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {wishlist.map((item) => (
            <li key={item.id} className="text-sm text-foreground">
              {item.product.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
