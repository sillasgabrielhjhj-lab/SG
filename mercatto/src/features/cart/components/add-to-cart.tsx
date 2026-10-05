"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ShoppingCart, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCartIndicator } from "@/components/providers/cart-indicator";
import { trackEvent } from "@/lib/analytics";
import { addToCartAction } from "@/features/cart/actions";

/** "Comprar agora" (vai direto ao carrinho/checkout) e "Adicionar ao carrinho" (abre o mini-carrinho). */
export function AddToCartButtons({ variantId, quantity, disabled, productName, priceCents, layout = "stack" }: { variantId: string | null; quantity: number; disabled?: boolean; productName: string; priceCents: number; layout?: "stack" | "row" }) {
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
    setCount(res.data.count);
    bump();
    trackEvent("add_to_cart", { item_name: productName, price: priceCents / 100, quantity });
    if (goToCart) router.push("/carrinho");
    else {
      toast.success("Adicionado ao carrinho", { description: productName });
      openMiniCart();
    }
  };

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
