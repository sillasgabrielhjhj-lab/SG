"use client";

import Link from "next/link";
import { User, Package, MapPin, Heart, Store, LogIn, LogOut, ShieldCheck } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";

export type SessionUser = {
  id: string;
  name: string;
  role: "USER" | "SELLER" | "ADMIN";
} | null;

export function AccountMenu({ user }: { user: SessionUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2 sm:px-3">
          <User className="size-5" />
          <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
            {user ? user.name.split(" ")[0] : "Conta"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {user ? (
          <DropdownMenuLabel className="truncate">Olá, {user.name}</DropdownMenuLabel>
        ) : (
          <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
        )}

        {!user && (
          <DropdownMenuItem asChild>
            <Link href="/entrar">
              <LogIn /> Entrar ou criar conta
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/minha-conta/pedidos">
            <Package /> Meus pedidos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/minha-conta/enderecos">
            <MapPin /> Endereços
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/minha-conta/favoritos">
            <Heart /> Favoritos
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {user?.role === "SELLER" && (
          <DropdownMenuItem asChild>
            <Link href="/vendedor">
              <Store /> Painel do vendedor
            </Link>
          </DropdownMenuItem>
        )}
        {user?.role !== "SELLER" && (
          <DropdownMenuItem asChild>
            <Link href="/vendedor">
              <Store /> Vender no Mercatto
            </Link>
          </DropdownMenuItem>
        )}
        {user?.role === "ADMIN" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck /> Painel administrativo
            </Link>
          </DropdownMenuItem>
        )}

        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild variant="destructive">
              <form action={logoutAction} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut /> Sair
                </button>
              </form>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
