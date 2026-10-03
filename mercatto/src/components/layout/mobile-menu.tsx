"use client";

import Link from "next/link";
import { Menu, LogIn, Package, MapPin, Heart, Store, LogOut } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/layout/logo";
import { categories } from "@/lib/mock-data";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionUser } from "@/components/layout/account-menu";

export function MobileMenu({ user }: { user: SessionUser }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <Logo />
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1">
          {user ? (
            <p className="truncate px-2 py-1 text-sm font-medium text-foreground">
              Olá, {user.name}
            </p>
          ) : (
            <Link href="/entrar" className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted">
              <LogIn className="size-4" /> Entrar ou criar conta
            </Link>
          )}
          <Link href="/minha-conta/pedidos" className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-muted">
            <Package className="size-4" /> Meus pedidos
          </Link>
          <Link href="/minha-conta/enderecos" className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-muted">
            <MapPin className="size-4" /> Endereços
          </Link>
          <Link href="/minha-conta/favoritos" className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-muted">
            <Heart className="size-4" /> Favoritos
          </Link>
          <Link href="/vendedor" className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-muted">
            <Store className="size-4" /> Vender no Mercatto
          </Link>
          {user && (
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" /> Sair
              </button>
            </form>
          )}
        </div>

        <Separator />

        <p className="px-2 text-xs font-semibold text-muted-foreground uppercase">
          Categorias
        </p>
        <div className="flex flex-col gap-0.5">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categoria/${category.slug}`}
              className="rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
