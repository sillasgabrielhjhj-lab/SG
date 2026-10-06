"use client";

import Link from "next/link";
import { Bell, Heart, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartIndicator } from "@/components/providers/cart-indicator";

export function CartLink({ className }: { className?: string }) {
  const { count, bumpKey } = useCartIndicator();
  return (
    <Link href="/carrinho" data-cart-target="" className={cn("press relative grid size-11 place-items-center rounded-field text-white transition-colors hover:bg-white/10 focus-ring", className)} aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}>
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 ? (
        <span key={bumpKey} className="absolute top-0.5 right-0.5 grid h-5 min-w-5 animate-bump place-items-center rounded-full bg-sun-400 px-1 text-2xs font-extrabold text-sun-900 tabular">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export function NotificationsLink({ unread, className }: { unread: number; className?: string }) {
  return (
    <Link href="/minha-conta/notificacoes" className={cn("relative grid size-11 place-items-center rounded-field text-white hover:bg-white/10 focus-ring", className)} aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}>
      <Bell className="size-[22px]" aria-hidden />
      {unread > 0 ? <span className="absolute top-2 right-2 size-2.5 rounded-full bg-coral-500 ring-2 ring-brand-800" /> : null}
    </Link>
  );
}

export function FavoritesLink({ className }: { className?: string }) {
  return (
    <Link href="/minha-conta/favoritos" className={cn("grid size-11 place-items-center rounded-field text-white hover:bg-white/10 focus-ring", className)} aria-label="Favoritos">
      <Heart className="size-[22px]" aria-hidden />
    </Link>
  );
}
