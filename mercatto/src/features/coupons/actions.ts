"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { AppError } from "@/server/errors";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/request";
import { getCartIdentity, setCartCoupon } from "@/features/cart/service";
import { findPromotableCoupon } from "@/features/coupons/campaign.server";

/**
 * "Quero meu desconto": guarda o cupom da campanha no carrinho (mesmo vazio).
 * Não calcula desconto aqui — o carrinho e o checkout validam o cupom a cada
 * cálculo (produtos participantes, mínimo, teto, validade, limite por cliente),
 * então nada que venha do navegador altera preço ou percentual.
 */
export const activateCampaignCouponAction = createAction(
  z.object({ code: z.string().trim().min(2).max(40) }),
  async ({ code }) => {
    await enforceRateLimit(`coupon-activate:${await getClientIp()}`, 20, 10 * 60);
    const coupon = await findPromotableCoupon(code);
    if (!coupon) throw new AppError("UNPROCESSABLE", "Este cupom não está disponível no momento.");
    const identity = (await getCartIdentity({ create: true }))!;
    await setCartCoupon(identity, coupon.code);
    revalidatePath("/carrinho");
    return ok({ code: coupon.code }, `Cupom ${coupon.code} ativado no seu carrinho.`);
  },
  "coupon.activate_campaign",
);
