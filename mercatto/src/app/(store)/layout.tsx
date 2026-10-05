import { db } from "@/server/db";
import { env } from "@/server/env";
import { getCurrentUser } from "@/server/auth/guards";
import { getCategoryTree } from "@/features/catalog/categories.server";
import { getCartItemCount } from "@/features/cart/count.server";
import { getStoreSettings } from "@/features/settings/queries";
import { AppProviders } from "@/components/providers/app-providers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MiniCart } from "@/features/cart/components/mini-cart";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, user, cartCount, settings] = await Promise.all([getCategoryTree(), getCurrentUser(), getCartItemCount(), getStoreSettings()]);
  const unreadNotifications = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const sandbox = env.PAYMENT_PROVIDER === "dev";
  return (
    <AppProviders cartCount={cartCount}>
      <a href="#conteudo" className="sr-only z-[60] rounded-md bg-surface px-4 py-2 font-semibold text-brand-800 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <Header
        data={{
          user: user ? { name: user.name, email: user.email, role: user.role, hasStore: Boolean(user.storeId) } : null,
          cartCount,
          unreadNotifications,
          categories,
          sandbox,
        }}
      />
      <main id="conteudo" className="min-h-[60vh] pb-20 md:pb-0">
        {children}
      </main>
      <Footer social={(settings.socialLinks as Record<string, string | null> | null) ?? null} sandbox={sandbox} contactEmail={settings.contactEmail} />
      <BottomNav />
      <MiniCart />
    </AppProviders>
  );
}
