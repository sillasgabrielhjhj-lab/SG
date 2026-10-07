"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ShoppingCart, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCartIndicator } from "@/components/providers/cart-indicator";
import { trackEvent } from "@/lib/analytics";
import { flyToCart } from "@/lib/fly-to-cart";
import { addToCartAction } from "@/features/cart/actions";

/**
 * "Comprar agora" (vai direto ao carrinho) e "Adicionar ao carrinho": a imagem
 * do produto voa até o carrinho e um aviso com "Ver carrinho" aparece — sem
 * bloquear a navegação.
 */
export function AddToCartButtons({ variantId, quantity, disabled, productName, priceCents, layout = "stack" }: { variantId: string | null; quantity: number; disabled?: boolean; productName: string; priceCents: number; layout?: "buyOnly" | "stack" | "row" }) {
  const [pending, start] = useTransition();
  const [buying, startBuy] = useTransition();
  const { setCount, bump, openMiniCart } = useCartIndicator();
  const toast = useToast();
  const router = useRouter();

  const add = async (goToCart: boolean) => {
    if (!variantId) {
      toast.warning("Escolha uma opção", { description: "Selecione as variações disponíveis antes de continuar." });
      return;
    }
    const res = await addToCartAction({ variantId, quantity });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    trackEvent("add_to_cart", { item_name: productName, price: priceCents / 100, quantity });
    if (goToCart) {
      setCount(res.data.count);
      router.push("/carrinho");
      return;
    }
    flyToCart(document.querySelector("[data-product-main-image] img") ?? document.querySelector("[data-product-main-image]"));
    // O contador "pula" quando a miniatura chega ao carrinho.
    window.setTimeout(() => {
      setCount(res.data.count);
      bump();
    }, 520);
    toast.success("Produto adicionado ao carrinho ✓", { description: productName, action: { label: "Ver carrinho", onClick: openMiniCart } });
  };

  if (layout === "buyOnly") {
    return (
      <Button size="md" disabled={disabled || pending} loading={buying} leftIcon={<Zap className="size-4" />} onClick={() => startBuy(() => add(true))}>
        Comprar agora
      </Button>
    );
  }
  return (
    <div className={layout === "row" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
      <Button size="lg" fullWidth disabled={disabled || pending} loading={buying} leftIcon={<Zap className="size-4" />} onClick={() => startBuy(() => add(true))}>
        Comprar agora
      </Button>
      <Button size="lg" variant="secondary" fullWidth disabled={disabled || buying} loading={pending} leftIcon={<ShoppingCart className="size-4" />} onClick={() => start(() => add(false))}>
        Adicionar ao carrinho
      </Button>
    </div>
  );
}
