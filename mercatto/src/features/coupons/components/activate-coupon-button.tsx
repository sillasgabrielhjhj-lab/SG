"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { trackEvent } from "@/lib/analytics";
import { activateCampaignCouponAction } from "@/features/coupons/actions";

/** Ativa o cupom no carrinho (validado no servidor a cada cálculo). */
export function ActivateCouponButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [active, setActive] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      size="lg"
      fullWidth
      loading={pending}
      loadingText="Ativando cupom"
      variant={active ? "secondary" : "primary"}
      leftIcon={active ? <Check className="size-4 animate-check" aria-hidden /> : <ShoppingCart className="size-4" aria-hidden />}
      onClick={() =>
        start(async () => {
          if (active) {
            router.push("/carrinho");
            return;
          }
          const res = await activateCampaignCouponAction({ code });
          trackEvent("coupon_applied", { coupon: code, source: "coupon_page", success: res.ok });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          setActive(true);
          toast.success("Cupom ativado ✓", { description: "Adicione um produto participante e veja o desconto no carrinho." });
        })
      }
    >
      {active ? "Cupom ativado — ver carrinho" : "Ativar cupom no carrinho"}
    </Button>
  );
}
