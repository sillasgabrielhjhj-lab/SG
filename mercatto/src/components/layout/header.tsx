import Link from "next/link";
import { MapPin } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { SearchBar } from "@/components/layout/search-bar";
import { AccountMenu } from "@/components/layout/account-menu";
import { CartButton } from "@/components/layout/cart-button";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { CategoryBar } from "@/components/layout/category-bar";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCartItemCount } from "@/lib/data/cart";

export async function Header() {
  const user = await getCurrentUser();
  const sessionUser = user ? { id: user.id, name: user.name, role: user.role } : null;
  const cartItemCount = await getCartItemCount(user?.id ?? null);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-6">
        <MobileMenu user={sessionUser} />

        <Link href="/" aria-label="Página inicial da Mercatto" className="shrink-0">
          <Logo />
        </Link>

        <SearchBar className="hidden max-w-xl flex-1 md:flex" />

        <button
          type="button"
          className="hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary lg:flex"
        >
          <MapPin className="size-4" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-xs">Enviar para</span>
            <span className="font-medium text-foreground">Recife, PE</span>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <AccountMenu user={sessionUser} />
          <CartButton itemCount={cartItemCount} />
        </div>
      </div>

      <div className="container-page pb-3 md:hidden">
        <SearchBar />
      </div>

      <CategoryBar />
    </header>
  );
}
