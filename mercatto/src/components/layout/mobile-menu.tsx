"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Bell, Heart, LogOut, Menu, Package, ShieldCheck, Store, Tag, User } from "lucide-react";
import type { CategoryNode } from "@/features/catalog/types";
import { Drawer } from "@/components/ui/drawer";
import { CategoryIcon } from "@/components/layout/category-icon";
import { logoutAction } from "@/features/auth/actions";
import type { HeaderUser } from "@/components/layout/types";

export function MobileMenu({ user, categories }: { user: HeaderUser | null; categories: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const link = "flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface-muted focus-ring";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-field text-white hover:bg-white/10 focus-ring lg:hidden" aria-label="Abrir menu">
        <Menu className="size-6" />
      </button>
      <Drawer open={open} onClose={close} side="left" title={user ? `Olá, ${user.name.split(" ")[0]}` : "Bem-vindo à Mercatto"}>
        {!user ? (
          <div className="flex gap-2 border-b border-line p-4">
            <Link href="/entrar" onClick={close} className="flex-1 rounded-field bg-brand-700 py-2.5 text-center text-sm font-semibold text-white">
              Entrar
            </Link>
            <Link href="/cadastro" onClick={close} className="flex-1 rounded-field border border-line-strong py-2.5 text-center text-sm font-semibold">
              Criar conta
            </Link>
          </div>
        ) : null}
        <nav aria-label="Menu principal" className="py-2">
          <Link href="/ofertas" onClick={close} className={link}>
            <Tag className="size-5 text-brand-700" aria-hidden /> Ofertas do dia
          </Link>
          <Link href="/oficial" onClick={close} className={link}>
            <BadgeCheck className="size-5 text-brand-700" aria-hidden /> Oficial Mercatto
          </Link>
          {user ? (
            <>
              <Link href="/minha-conta" onClick={close} className={link}>
                <User className="size-5 text-fg-subtle" aria-hidden /> Minha conta
              </Link>
              <Link href="/minha-conta/pedidos" onClick={close} className={link}>
                <Package className="size-5 text-fg-subtle" aria-hidden /> Meus pedidos
              </Link>
              <Link href="/minha-conta/favoritos" onClick={close} className={link}>
                <Heart className="size-5 text-fg-subtle" aria-hidden /> Favoritos
              </Link>
              <Link href="/minha-conta/notificacoes" onClick={close} className={link}>
                <Bell className="size-5 text-fg-subtle" aria-hidden /> Notificações
              </Link>
            </>
          ) : null}
          <Link href={user?.hasStore ? "/vendedor" : "/vender"} onClick={close} className={link}>
            <Store className="size-5 text-fg-subtle" aria-hidden /> {user?.hasStore ? "Painel do vendedor" : "Vender na Mercatto"}
          </Link>
          {user && (user.role === "ADMIN" || user.role === "SUPPORT") ? (
            <Link href="/admin" onClick={close} className={link}>
              <ShieldCheck className="size-5 text-fg-subtle" aria-hidden /> Painel administrativo
            </Link>
          ) : null}
        </nav>
        <div className="border-t border-line py-2">
          <p className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Categorias</p>
          {categories.map((c) => (
            <details key={c.id} className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                <CategoryIcon name={c.icon} className="size-5 text-brand-700" />
                <span className="flex-1">{c.name}</span>
                <span className="text-fg-subtle transition-transform group-open:rotate-90" aria-hidden>
                  ›
                </span>
              </summary>
              <ul className="bg-surface-muted py-1">
                <li>
                  <Link href={`/categoria/${c.slug}`} onClick={close} className="block px-12 py-2.5 text-sm font-semibold text-brand-700">
                    Ver tudo
                  </Link>
                </li>
                {c.children.map((ch) => (
                  <li key={ch.id}>
                    <Link href={`/categoria/${ch.slug}`} onClick={close} className="block px-12 py-2.5 text-sm text-fg-muted">
                      {ch.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        {user ? (
          <form action={logoutAction} className="border-t border-line p-2">
            <button type="submit" className={`${link} w-full text-danger-700`}>
              <LogOut className="size-5" aria-hidden /> Sair
            </button>
          </form>
        ) : null}
      </Drawer>
    </>
  );
}
