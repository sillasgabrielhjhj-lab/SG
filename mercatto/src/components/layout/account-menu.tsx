"use client";

import Link from "next/link";
import { ChevronDown, Heart, LayoutDashboard, LogOut, Package, Settings, ShieldCheck, Store, User } from "lucide-react";
import { DropdownMenu, type DropdownItem } from "@/components/ui/dropdown";
import { logoutAction } from "@/features/auth/actions";
import type { HeaderUser } from "@/components/layout/types";

export function AccountMenu({ user }: { user: HeaderUser | null }) {
  if (!user) {
    return (
      <div className="hidden items-center gap-3 text-sm font-semibold text-white lg:flex">
        <Link href="/cadastro" className="rounded-md hover:underline focus-ring">
          Crie sua conta
        </Link>
        <Link href="/entrar" className="rounded-md hover:underline focus-ring">
          Entre
        </Link>
      </div>
    );
  }
  const first = user.name.split(" ")[0];
  const items: DropdownItem[] = [
    { type: "link", label: "Minha conta", href: "/minha-conta", icon: <User /> },
    { type: "link", label: "Meus pedidos", href: "/minha-conta/pedidos", icon: <Package /> },
    { type: "link", label: "Favoritos", href: "/minha-conta/favoritos", icon: <Heart /> },
    { type: "link", label: "Dados e segurança", href: "/minha-conta/dados", icon: <Settings /> },
    { type: "separator" },
    user.hasStore || user.role === "SELLER"
      ? { type: "link", label: "Painel do vendedor", href: "/vendedor", icon: <Store /> }
      : { type: "link", label: "Vender na Mercatto", href: "/vender", icon: <Store /> },
    ...(user.role === "ADMIN" || user.role === "SUPPORT" ? [{ type: "link" as const, label: "Painel administrativo", href: "/admin", icon: <ShieldCheck /> }] : []),
    { type: "separator" },
    {
      type: "custom",
      node: (
        <form action={logoutAction}>
          <button type="submit" role="menuitem" tabIndex={-1} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-danger-700 outline-none hover:bg-danger-50 focus-visible:bg-danger-50">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </form>
      ),
    },
  ];
  return (
    <DropdownMenu
      label="Menu da conta"
      items={items}
      header={
        <div className="mb-1 flex items-center gap-2 border-b border-line px-3 pt-1.5 pb-2.5">
          <LayoutDashboard className="size-4 text-brand-700" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-fg-muted">{user.email}</p>
          </div>
        </div>
      }
      trigger={({ open }) => (
        <span className="flex items-center gap-1.5 rounded-field px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/10">
          <User className="size-5" aria-hidden />
          <span className="hidden max-w-28 truncate xl:inline">Olá, {first}</span>
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </span>
      )}
    />
  );
}
