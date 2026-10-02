"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL, formatInstallments } from "@/lib/utils";

type Variant = {
  id: string;
  name: string;
  priceCents: number | null;
  attributes: unknown;
  inventory: { quantity: number; reserved: number } | null;
};

export function PurchaseBox({
  basePriceCents,
  compareAtPriceCents,
  baseInventory,
  variants,
}: {
  basePriceCents: number;
  compareAtPriceCents: number | null;
  baseInventory: { quantity: number; reserved: number } | null;
  variants: Variant[];
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants[0]?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;

  const priceCents = selectedVariant?.priceCents ?? basePriceCents;
  const availableStock = useMemo(() => {
    const inv = selectedVariant ? selectedVariant.inventory : baseInventory;
    if (!inv) return 0;
    return Math.max(0, inv.quantity - inv.reserved);
  }, [selectedVariant, baseInventory]);

  const inStock = availableStock > 0;
  const maxQuantity = Math.min(availableStock, 10);

  function handleAddToCart() {
    if (variants.length > 0 && !selectedVariant) {
      toast.error("Selecione uma opção antes de continuar");
      return;
    }
    toast.message("Carrinho chega na próxima fase do projeto", {
      description: "Por enquanto esta é só uma prévia da página de produto.",
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
      <div>
        {compareAtPriceCents && compareAtPriceCents > priceCents && (
          <span className="text-sm text-muted-foreground line-through">
            {formatCurrencyBRL(compareAtPriceCents)}
          </span>
        )}
        <p className="font-display text-3xl font-bold text-foreground">
          {formatCurrencyBRL(priceCents)}
        </p>
        <p className="text-sm text-muted-foreground">{formatInstallments(priceCents)}</p>
      </div>

      {variants.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Opções</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const variantStock = variant.inventory
                ? variant.inventory.quantity - variant.inventory.reserved
                : 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={variantStock <= 0}
                  onClick={() => {
                    setSelectedVariantId(variant.id);
                    setQuantity(1);
                  }}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    selectedVariantId === variant.id
                      ? "border-primary bg-secondary text-foreground"
                      : "border-input text-muted-foreground hover:border-primary"
                  }`}
                >
                  {variant.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        {inStock ? (
          <Badge variant="success">Em estoque{availableStock <= 5 ? ` — últimas ${availableStock} unidades` : ""}</Badge>
        ) : (
          <Badge variant="destructive">Produto indisponível</Badge>
        )}
      </div>

      {inStock && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Quantidade</span>
          <div className="flex items-center rounded-md border border-input">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Diminuir quantidade"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-medium">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Aumentar quantidade"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={!inStock} onClick={handleAddToCart}>
          <Zap className="size-4" /> Comprar agora
        </Button>
        <Button size="lg" variant="outline" disabled={!inStock} onClick={handleAddToCart}>
          <ShoppingCart className="size-4" /> Adicionar ao carrinho
        </Button>
      </div>
    </div>
  );
}
