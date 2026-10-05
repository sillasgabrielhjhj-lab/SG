"use client";

import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";

/**
 * Stripe.js carregado sob demanda (variante "pure": nada é baixado até o
 * primeiro uso, então páginas sem cartão Stripe não carregam o script).
 * Uma instância por chave publicável.
 */
const instances = new Map<string, Promise<Stripe | null>>();

export function getStripe(publishableKey: string): Promise<Stripe | null> {
  let instance = instances.get(publishableKey);
  if (!instance) {
    instance = loadStripe(publishableKey, { locale: "pt-BR" }).catch((error: unknown) => {
      instances.delete(publishableKey);
      throw error;
    });
    instances.set(publishableKey, instance);
  }
  return instance;
}

const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", elo: "Elo", hipercard: "Hipercard", diners: "Diners", discover: "Discover", jcb: "JCB" };

export function cardBrandName(brand: string | null | undefined): string {
  return (brand && BRANDS[brand]) || "Cartão";
}
