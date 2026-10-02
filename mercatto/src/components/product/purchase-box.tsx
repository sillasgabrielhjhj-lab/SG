"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL, formatInstallments } from "@/lib/utils";
import { addToCartAction } from "@/lib/actions/cart";
import type { ActionState } from "@/lib/actions/auth";

type Variant = {
  id: string;
  name: string;
  priceCents: number | null;
  attributes: unknown;
  inventory: { quantity: number; reserved: number } | null;
};

export function PurchaseBox({
  productId,
  productSlug,
  basePriceCents,
  compareAtPriceCents,
  baseInventory,
  variants,
  isAuthenticated,
}: {
  productId: string;
  productSlug: string;
  basePriceCents: number;
  compareAtPriceCents: number | null;
  baseInventory: { quantity: number; reserved: number } | null;
  variants: Variant[];
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

  function submitToCart(): Promise<ActionState> {
    const formData = new FormData();
    formData.set("productId", productId);
    if (selectedVariant) formData.set("variantId", selectedVariant.id);
    formData.set("quantity", String(quantity));
    return addToCartAction({ status: "idle" }, formData);
  }

  function handleAddToCart() {
    if (!isAuthenticated) {
      router.push(`/entrar?next=${encodeURIComponent(`/produto/${productSlug}`)}`);
      return;
    }
    if (variants.length > 0 && !selectedVariant) {
      toast.error("Selecione uma opção antes de continuar");
      return;
    }
    startTransition(async () => {
      const result = await submitToCart();
      if (result.status === "error") {
        toast.error(result.message ?? "Não foi possível adicionar ao carrinho.");
      } else {
        toast.success("Produto adicionado ao carrinho.");
        router.refresh();
      }
    });
  }

  function handleBuyNow() {
    if (!isAuthenticated) {
      router.push(`/entrar?next=${encodeURIComponent(`/produto/${productSlug}`)}`);
      return;
    }
    if (variants.length > 0 && !selectedVariant) {
      toast.error("Selecione uma opção antes de continuar");
      return;
    }
    startTransition(async () => {
      const result = await submitToCart();
      if (result.status === "error") {
        toast.error(result.message ?? "Não foi possível continuar a compra.");
        return;
      }
      router.push("/checkout");
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
        <Button size="lg" disabled={!inStock || isPending} onClick={handleBuyNow}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          Comprar agora
        </Button>
        <Button size="lg" variant="outline" disabled={!inStock || isPending} onClick={handleAddToCart}>
          <ShoppingCart className="size-4" /> Adicionar ao carrinho
        </Button>
      </div>
    </div>
  );
}
