"use client";

import Link from "next/link";
import { User, Package, MapPin, Heart, Store, LogIn } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/** Fase 1: menu estático (sem sessão real ainda — isso chega na Fase 2). */
export function AccountMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2 sm:px-3">
          <User className="size-5" />
          <span className="hidden text-sm font-medium sm:inline">Conta</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/entrar">
            <LogIn /> Entrar ou criar conta
          </Link>
        </DropdownMenuItem>
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
        <DropdownMenuItem asChild>
          <Link href="/vendedor">
            <Store /> Vender no Mercatto
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
