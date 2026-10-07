"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ok } from "@/server/action";
import { AppError } from "@/server/errors";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/request";
import { findCart, getCartIdentity, setCartCoupon } from "@/features/cart/service";
import { couponBlockedForUser, findPromotableCoupon } from "@/features/coupons/campaign.server";

/**
 * "Quero meu desconto": guarda o cupom da campanha no carrinho (mesmo vazio).
 * Recusa com o motivo quando o cliente logado já não pode usar o cupom e não
 * troca, sem avisar, outro cupom que já esteja no carrinho.
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
    const blocked = await couponBlockedForUser(coupon, identity.userId ?? null);
    if (blocked) throw new AppError("UNPROCESSABLE", blocked);
    const current = (await findCart(identity))?.couponCode;
    if (current && current !== coupon.code) {
      throw new AppError("CONFLICT", `Seu carrinho já tem o cupom ${current}. Remova-o no carrinho para usar o ${coupon.code}.`);
    }
    await setCartCoupon(identity, coupon.code);
    revalidatePath("/carrinho");
    return ok({ code: coupon.code }, `Cupom ${coupon.code} ativado no seu carrinho.`);
  },
  "coupon.activate_campaign",
);
