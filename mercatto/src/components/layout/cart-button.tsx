"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CartButton({ itemCount = 0 }: { itemCount?: number }) {
  return (
    <Button
      asChild
      variant="ghost"
      className="relative h-10 gap-2 px-2 sm:px-3"
    >
      <Link href="/carrinho" aria-label="Carrinho de compras">
        <span className="relative">
          <ShoppingCart className="size-5" />
          {itemCount > 0 && (
            <Badge
              variant="accent"
              className="absolute -top-2 -right-2 size-5 justify-center p-0 text-[10px]"
            >
              {itemCount}
            </Badge>
          )}
        </span>
        <span className="hidden text-sm font-medium sm:inline">Carrinho</span>
      </Link>
    </Button>
  );
}
