import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { tryGetPaymentGateway } from "@/server/providers/payments";
import { getStoreSettings } from "@/features/settings/queries";
import { effectiveInstallmentConfig } from "@/features/checkout/installments";

export type StoreBenefit = {
  key: "pix" | "card" | "shipping" | "secure" | "returns" | "support";
  title: string;
  description: string;
  href: string;
};

/**
 * Benefícios reais da loja, derivados da configuração (gateway, parcelamento,
 * tabela de frete). Usados na faixa de benefícios e na seção de confiança —
 * nenhum texto promete o que a configuração atual não entrega.
 */
export const getStoreBenefits = cache(async () => {
  const [settings, nationwideRule] = await Promise.all([
    getStoreSettings(),
    env.SHIPPING_PROVIDER === "melhorenvio" ? Promise.resolve(1) : db.shippingRule.count({ where: { storeId: null, isActive: true, regionCode: "OTHER" } }),
  ]);
  const { gateway } = tryGetPaymentGateway();
  const methods = new Set<string>(gateway?.supportsMethods ?? []);
  const installments = effectiveInstallmentConfig(settings).interestFreeInstallments;

  const items: StoreBenefit[] = [];
  if (methods.has("PIX")) items.push({ key: "pix", title: "PIX", description: "Aprovação na hora", href: "/ajuda" });
  if (methods.has("CREDIT_CARD")) {
    items.push({ key: "card", title: "Cartão de crédito", description: installments > 1 ? `Até ${installments}x sem juros` : "Parcele suas compras", href: "/ajuda" });
  }
  items.push({ key: "shipping", title: "Entrega", description: nationwideRule > 0 ? "Para todo o Brasil" : "Com rastreio do pedido", href: "/ajuda" });
  items.push({ key: "secure", title: "Compra segura", description: "Pagamento protegido", href: "/seguranca" });
  items.push({ key: "returns", title: "Devolução", description: "7 dias para se arrepender", href: "/trocas-e-devolucoes" });

  return { items, methods: [...methods], installments };
});
