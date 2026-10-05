import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/guards";
import { getCartIdentity } from "@/features/cart/service";
import { getCartView } from "@/features/cart/queries";
import { privateMetadata } from "@/features/seo/metadata";
import { CartPageView } from "@/features/cart/components/cart-view";
import { RecentlyViewed } from "@/features/home/components/recently-viewed";

export const metadata: Metadata = privateMetadata("Carrinho");

export default async function CartPage() {
  const [identity, user] = await Promise.all([getCartIdentity({ create: false }), getCurrentUser()]);
  const cart = await getCartView(identity);
  return (
    <div className="container-page flex flex-col gap-8 py-4 sm:py-6">
      <div>
        <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">Carrinho</h1>
        <CartPageView cart={cart} isLoggedIn={Boolean(user)} />
      </div>
      <RecentlyViewed title="Você também viu" />
    </div>
  );
}
