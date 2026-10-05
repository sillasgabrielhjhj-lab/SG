"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Package, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartIndicator } from "@/components/providers/cart-indicator";

const ITEMS = [
  { href: "/", label: "Início", icon: Home, match: (p: string) => p === "/" },
  { href: "/categorias", label: "Categorias", icon: LayoutGrid, match: (p: string) => p.startsWith("/categoria") },
  { href: "/carrinho", label: "Carrinho", icon: ShoppingCart, match: (p: string) => p.startsWith("/carrinho") },
  { href: "/minha-conta/pedidos", label: "Pedidos", icon: Package, match: (p: string) => p.startsWith("/minha-conta/pedidos") },
  { href: "/minha-conta", label: "Conta", icon: User, match: (p: string) => p === "/minha-conta" || (p.startsWith("/minha-conta/") && !p.startsWith("/minha-conta/pedidos")) },
];

/** Navegação inferior estilo aplicativo (somente mobile). */
export function BottomNav() {
  const pathname = usePathname();
  const { count } = useCartIndicator();
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-2xs font-semibold focus-ring", active ? "text-brand-700" : "text-fg-muted")}>
                {active ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-700" aria-hidden /> : null}
                <span className="relative">
                  <Icon className="size-[22px]" aria-hidden />
                  {href === "/carrinho" && count > 0 ? <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-sun-400 px-1 text-[10px] font-extrabold text-sun-900">{count > 99 ? "99+" : count}</span> : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
