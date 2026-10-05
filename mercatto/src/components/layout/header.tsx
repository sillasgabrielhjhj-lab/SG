import Link from "next/link";
import { BadgeCheck, FlaskConical, Store, Tag } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { CartLink, FavoritesLink, NotificationsLink } from "@/components/layout/header-actions";
import { CategoriesMenu } from "@/components/layout/categories-menu";
import { CepSelector } from "@/components/layout/cep-selector";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SearchBar } from "@/components/layout/search-bar";
import { StickyHeader } from "@/components/layout/sticky-header";
import type { HeaderData } from "@/components/layout/types";

export function DevEnvironmentBanner() {
  return (
    <div className="bg-sun-200 text-sun-900">
      <p className="container-page flex items-center justify-center gap-2 py-1 text-center text-2xs font-semibold sm:text-xs">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        Ambiente de demonstração — pagamentos simulados, nenhuma cobrança real. Produtos marcados como DEMO.
      </p>
    </div>
  );
}

export function Header({ data }: { data: HeaderData }) {
  const featured = data.categories.filter((c) => c.isFeatured).slice(0, 5);
  return (
    <>
      {data.sandbox ? <DevEnvironmentBanner /> : null}
      <StickyHeader>
        <div className="container-page flex h-16 items-center gap-2 sm:gap-4">
          <MobileMenu user={data.user} categories={data.categories} />
          <Link href="/" className="shrink-0 rounded-md focus-ring" aria-label="Mercatto — página inicial">
            <Logo tone="inverse" size="md" className="max-sm:[&>span:last-child]:text-[1.35rem]" />
          </Link>
          <div className="hidden min-w-0 flex-1 md:block lg:max-w-2xl xl:max-w-3xl">
            <SearchBar />
          </div>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <AccountMenu user={data.user} />
            {data.user ? <NotificationsLink unread={data.unreadNotifications} className="max-sm:hidden" /> : null}
            {data.user ? <FavoritesLink className="max-lg:hidden" /> : null}
            <CartLink />
          </div>
        </div>
        <div className="container-page pb-2.5 md:hidden">
          <SearchBar />
        </div>
        <div className="hidden border-t border-white/10 lg:block">
          <nav aria-label="Navegação da loja" className="container-page flex h-11 items-center gap-1">
            <CepSelector className="mr-3 max-w-56" />
            <CategoriesMenu categories={data.categories} />
            <Link href="/ofertas" className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-sun-300 hover:bg-white/10 focus-ring">
              <Tag className="size-4" aria-hidden /> Ofertas do dia
            </Link>
            <Link href="/oficial" className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white focus-ring">
              <BadgeCheck className="size-4" aria-hidden /> Oficial Mercatto
            </Link>
            {featured.map((c) => (
              <Link key={c.id} href={`/categoria/${c.slug}`} className="hidden h-9 items-center rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-white/90 hover:bg-white/10 hover:text-white focus-ring xl:flex">
                {c.name}
              </Link>
            ))}
            <Link href={data.user?.hasStore ? "/vendedor" : "/vender"} className="ml-auto flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white focus-ring">
              <Store className="size-4" aria-hidden /> {data.user?.hasStore ? "Painel do vendedor" : "Vender"}
            </Link>
          </nav>
        </div>
      </StickyHeader>
      <div className="border-b border-line bg-surface lg:hidden">
        <div className="container-page py-1.5">
          <CepSelector tone="default" />
        </div>
      </div>
    </>
  );
}
